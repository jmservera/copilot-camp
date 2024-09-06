(() => {

    // Web controls for Copilot Camp lab step tracking

    function ensureCss() {

        const css = `
            .lab-end-step {
                background-color: gray;
                color: white;
                padding: 4pt 20pt 4pt 4pt;
                display: inline-block;
                border-radius: 0 22pt 22pt 0;
            }
            .lab-end-step input[type=checkbox] {
                -ms-transform: scale(1.5);  /* IE */
                -moz-transform: scale(1.5); /* FF */
                -webkit-transform: scale(1.5); /* Safari and Chrome */
                -o-transform: scale(1.5);  /* Opera */
                transform: scale(1.5);
            }
            .lab-end-step .subtext {
                font-size: 0.8em;
                font-style: italic;
                padding-left: 18pt;
                margin-top -9pt;
            }
            h3 {
                border-top: 4px solid gray;
                border-bottom: 4px solid gray;
            }      
        `;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets = [sheet];
    };


    // cc-lab-end-step web component
    // Goes at the end of a step in a lab to track completion
    class LabEndStep extends HTMLElement {

        checked;    // True if the checkbox is checked
        lab;        // Lab number   
        exercise;   // Exercise number
        step;       // Step number
        label;      // Step header text

        // Child controls
        #containerElement; // Div container
        #subLabelElement;  // Subtext element
        #telemetrySent = false; // True if telemetry has been sent

        constructor() {
            super();

            this.lab = this.getAttribute('lab');
            this.exercise = this.getAttribute('exercise');
            this.step = this.getAttribute('step');

            ensureCss();

            this.#containerElement = document.createElement('div');
            this.#containerElement.className = 'lab-end-step';

            const checkBoxElement = document.createElement('input');
            checkBoxElement.setAttribute('type', 'checkbox');
            checkBoxElement.checked =
                this.#getStepStatus(this.lab, this.exercise, this.step) === 'true';
            this.checked = checkBoxElement.checked;
            checkBoxElement.id = `ex-${this.exercise}-step-${this.step}`;
            this.#containerElement.appendChild(checkBoxElement);

            const labelElement = document.createElement('label');
            labelElement.innerText = ` End of Exercise ${this.exercise}, ${this.#getSectionLabelAndUpdateHeader()}`;
            this.#containerElement.appendChild(labelElement);

            const breakElement = document.createElement('br');
            this.#containerElement.appendChild(breakElement);

            this.#subLabelElement = document.createElement('label');
            this.#subLabelElement.className = 'subtext';
            this.#subLabelElement.innerText = this.#getSubtext();
            this.#containerElement.appendChild(this.#subLabelElement);

            this.replaceChildren(this.#containerElement);
        }

        // Checkbox click event handler
        #clickHandler(e) {
            this.checked = e.target.checked;
            this.#setStepStatus(this.lab, this.exercise, this.step, this.checked);
            this.#getSectionLabelAndUpdateHeader();
            this.#changeListeners.forEach(listener => listener());
            this.#subLabelElement.innerText = this.#getSubtext();
            this.#updateTelemetry(this.lab, this.exercise, this.step);
        }
        async connectedCallback() {
            this.onclick = this.#clickHandler;
        }

        // onChange event handler
        #changeListeners = [];
        set onChange(value) {
            this.#changeListeners.push(value);
        }

        // Finds the section header text, adds a checkbox if needed, and returns
        // the section header text
        #getSectionLabelAndUpdateHeader() {
            let elt = this.previousSibling?.parentElement || this.parentElement;
            while (elt && elt.tagName !== 'H3') {
                elt = elt.previousElementSibling;
            }
            if (elt) {
                this.label = elt.innerText.replace('✔', '').trim();
                if (this.checked) {
                    elt.innerText = '✔ ' + this.label;
                } else {
                    elt.innerText = this.label;
                }
                return this.label;
            }
            return ''
        }

        // Subtext generator
        #getSubtext() {
            if (this.checked) {
                switch (this.step) {
                    case '1':
                        return 'Great start! Now move on to the next step.';
                    case '2':
                        return 'Good job, keep going!';
                    case '3':
                        return 'Nice one!';
                    case '4':
                        return 'Well done!';
                    case '5':
                        return 'Alright, you did it!';
                    case '6':
                        return 'Keep up the good work!';
                    case '7':
                        return 'Woo-hoo!!';
                    case '8':
                        return 'Can you believe this exercise has so many steps?';
                    case '9':
                        return 'Nine steps was a lot but you did it!';
                    default:
                        return `Congratulations!`;
                }
            } else {
                return 'Check the box when you have completed this step.';
            }
        }

        // Telemetry
        #updateTelemetry(lab, exercise, step) {
            if (this.checked && !this.#telemetrySent) {
                const url = `https://pnptelemetry.azurewebsites.net/copilot-camp/completed-lab-${lab}-ex-${exercise}-step-${step}`;
                const img = new Image();
                img.src = url;
                this.#containerElement.appendChild(img);
                this.#telemetrySent = true;
            }
        }

        // Storage functions
        #getStepStatus(lab, exercise, step) {
            return localStorage.getItem(`step-${lab}-${exercise}-${step}`);
        }

        #setStepStatus(lab, exercise, step, status) {
            localStorage.setItem(`step-${lab}-${exercise}-${step}`, status);
        }
    }

    // cc-last-completed-step web component
    class LastCompletedStep extends HTMLElement {

        anchorElement; // HTML element to display the last completed step

        constructor() {
            super();

            // Set up an event listener for all cc-lab-step elements on the page
            const elts = document.querySelectorAll('cc-lab-end-step');
            for (let elt of elts) {
                elt.onChange = this.#updateText.bind(this);
            }

            this.anchorElement = document.createElement('a');
            this.replaceChildren(this.anchorElement);

            this.#updateText();
        }

        #updateText() {
            if (this.anchorElement) {
                let lastCompletedExercise = 0;
                let lastCompletedStep = 0;
                let lastCompletedStepTitle = '';
                const elts = document.querySelectorAll('cc-lab-end-step');
                for (let elt of elts) {
                    if (elt.checked) {
                        lastCompletedExercise = elt.exercise;
                        lastCompletedStep = elt.step;
                        lastCompletedStepTitle = elt.label;
                    }
                }
                if (lastCompletedExercise === 0) {
                    this.anchorElement.innerText = 'You have not completed any steps in this lab. Use the ☑ checkbox on each step to track your progress.';
                    this.anchorElement.href = '#';
                    this.anchorElement.style = 'pointer-events: none; color: black;';
                } else {
                    this.anchorElement.innerText = `✔ You last completed Exercise ${lastCompletedExercise}: ${lastCompletedStepTitle}`;
                    this.anchorElement.href = `#ex-${lastCompletedExercise}-step-${lastCompletedStep}`;
                    this.anchorElement.style = '';
                }
            }
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        window.customElements.define('cc-lab-end-step', LabEndStep);
        window.customElements.define('cc-last-completed-step', LastCompletedStep);
    });

})();