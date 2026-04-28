const { TableClient, TableServiceClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

const TABLE_NAMES = [ "Project", "Consultant", "Assignment" ];

function createTableServiceClient(accountNameOrConnStr) {
    if (!accountNameOrConnStr || accountNameOrConnStr === "UseDevelopmentStorage=true") {
        return TableServiceClient.fromConnectionString("UseDevelopmentStorage=true");
    }
    // If it looks like a connection string, use it directly
    if (accountNameOrConnStr.includes("AccountKey=") || accountNameOrConnStr.includes("DefaultEndpointsProtocol=")) {
        return TableServiceClient.fromConnectionString(accountNameOrConnStr);
    }
    // Otherwise treat as account name and use managed identity
    const url = `https://${accountNameOrConnStr}.table.core.windows.net`;
    return new TableServiceClient(url, new DefaultAzureCredential());
}

function createTableClient(accountNameOrConnStr, tableName) {
    if (!accountNameOrConnStr || accountNameOrConnStr === "UseDevelopmentStorage=true") {
        return TableClient.fromConnectionString("UseDevelopmentStorage=true", tableName);
    }
    if (accountNameOrConnStr.includes("AccountKey=") || accountNameOrConnStr.includes("DefaultEndpointsProtocol=")) {
        return TableClient.fromConnectionString(accountNameOrConnStr, tableName);
    }
    const url = `https://${accountNameOrConnStr}.table.core.windows.net`;
    return new TableClient(url, tableName, new DefaultAzureCredential());
}

(async () => {

    const accountNameOrConnStr = process.argv[2] ? process.argv[2] : "UseDevelopmentStorage=true";
    const reset = process.argv[3] === "--reset" || process.argv[3] === "-r" ? true : false;

    const tableServiceClient = createTableServiceClient(accountNameOrConnStr);

    // Function returns an array of table names in the storage account
    async function getTables(tableServiceClient) {
        let tables = [];
        for await (const table of tableServiceClient.listTables()) {
            tables.push(table.name)
        }
        return tables;
    }

    // If reset is true, delete all tables
    if (reset) {
        const tables = await getTables(tableServiceClient);
        tables.forEach(async table => {
            const tableClient = createTableClient(accountNameOrConnStr, table);
            console.log(`Deleting table: ${table}`);
            await tableClient.deleteTable();
        });
        let tablesExist = true;
        while (tablesExist) {
            console.log("Waiting for tables to be deleted...");
            const tables = await getTables(tableServiceClient);
            if (tables.length === 0) {
                tablesExist = false;
                console.log("All tables deleted.");
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Create and populate tables
    TABLE_NAMES.forEach(async (tableName, index) => {

        // Skip if table already exists
        const tables = await getTables(tableServiceClient);
        if (tables.includes(tableName)) {
            console.log(`Table ${tableName} already exists, skipping...`);
            return;
        }

        // Create table if needed
        console.log(`Creating table: ${tableName}`);
        let tableCreated = false;
        while (!tableCreated) {
            try {
                await tableServiceClient.createTable(tableName);
                tableCreated = true;
            } catch (err) {
                if (err.statusCode === 409) {
                    console.log('Table is marked for deletion, retrying in 5 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    throw err;
                }
            }
        }

        // Add entities to table
        const tableClient = createTableClient(accountNameOrConnStr, tableName);
        const jsonString = fs.readFileSync(path.resolve(__dirname, "db", `${tableName}.json`), "utf8");
        const entities = JSON.parse(jsonString);

        for (const entity of entities["rows"]) {
            const rowKey = entity["id"].toString() || randomUUID();
            // Convert any nested objects to JSON strings
            for (const key in entity) {
                const valueType = Object.prototype.toString.call(entity[key]);
                if (valueType === "[object Object]" || valueType === "[object Array]") {
                    entity[key] = JSON.stringify(entity[key]);
                }
            }
            await tableClient.createEntity({
                partitionKey: tableName,
                rowKey,
                ...entity
            });

            console.log(`Added entity to ${tableName} with key ${rowKey}`);

        }
    });

})();