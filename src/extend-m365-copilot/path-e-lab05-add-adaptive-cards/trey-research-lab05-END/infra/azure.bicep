@maxLength(20)
@minLength(4)
param resourceBaseName string
param functionAppSKU string
param functionStorageSKU string

param location string = resourceGroup().location
param serverfarmsName string = resourceBaseName
param functionAppName string = resourceBaseName
param functionStorageName string = '${resourceBaseName}api'

// Azure Storage is required when creating Azure Functions instance
resource functionStorage 'Microsoft.Storage/storageAccounts@2021-06-01' = {
  name: functionStorageName
  kind: 'StorageV2'
  location: location
  sku: {
    name: functionStorageSKU// You can follow https://aka.ms/teamsfx-bicep-add-param-tutorial to add functionStorageSKUproperty to provisionParameters to override the default value "Standard_LRS".
  }
}

// Storage account for database table storage
resource storageAccount 'Microsoft.Storage/storageAccounts@2021-04-01' = {
  name: resourceBaseName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
}

// Compute resources for Azure Functions
resource serverfarms 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: serverfarmsName
  location: location
  sku: {
    name: functionAppSKU // You can follow https://aka.ms/teamsfx-bicep-add-param-tutorial to add functionServerfarmsSku property to provisionParameters to override the default value "Y1".
  }
  properties: {}
}

// Azure Functions that hosts your function code
resource functionApp 'Microsoft.Web/sites@2021-02-01' = {
  name: functionAppName
  kind: 'functionapp'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: serverfarms.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: functionStorage.name
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4' // Use Azure Functions runtime v4
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node' // Set runtime to NodeJS
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING__accountName'
          value: functionStorage.name
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1' // Run Azure Functions from a package file
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~18' // Set NodeJS version to 18.x
        }
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
      ]
      ftpsState: 'FtpsOnly'
    }
  }
}
var apiEndpoint = 'https://${functionApp.properties.defaultHostName}'


// Role assignments for managed identity
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// Grant Function App managed identity access to data storage account
resource dataStorageTableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource dataStorageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Function App managed identity access to function storage account
resource functionStorageTableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionStorage.id, functionApp.id, storageTableDataContributorRoleId)
  scope: functionStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionStorageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionStorage.id, functionApp.id, storageBlobDataContributorRoleId)
  scope: functionStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// The output will be persisted in .env.{envName}. Visit https://aka.ms/teamsfx-actions/arm-deploy for more details.
output API_FUNCTION_ENDPOINT string = apiEndpoint
output API_FUNCTION_RESOURCE_ID string = functionApp.id
output OPENAPI_SERVER_URL string = apiEndpoint
output STORAGE_ACCOUNT_NAME string = storageAccount.name
