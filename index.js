// Sony-Bravia

const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const UpgradeScripts = require('./src/upgrades')

const config = require('./src/config')
const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

const api = require('./src/api')

class TSLProductsUMDListenerInstance extends InstanceBase {
        constructor(internal) {
                super(internal)

                // Assign the methods from the listed files to this class
                Object.assign(this, {
                        ...config,
                        ...actions,
                        ...feedbacks,
                        ...variables,
                        ...presets,
                        ...api,
                })

                this.oldPortType = ''

                this.SERVER = undefined
                this.TALLIES = []
                this.CHOICES_TALLYADDRESSES = [{ id: -1, label: 'No tally data received yet...' }]

                this.ROSS_MLE_STATE = {
                        mle1: { pgm: 0, pvw: 0 },
                        mle2: { pgm: 0, pvw: 0 },
                        mle3: { pgm: 0, pvw: 0 },
                }
                this.ROSS_LABELS = {}
        }

        async destroy() {
                let self = this

                self.closePort()
        }

        async init(config) {
                this.configUpdated(config)
        }

        async configUpdated(config) {
                this.config = config

                if (config) {
                        this.oldPortType = this.config.porttype
                        this.config = config
                }

                if (this.SERVER !== undefined) {
                        //close out any open ports and re-init
                        this.closePort()
                }

                // Quickly check if certain config values are present and continue setup
                if (this.config.port) {
                        //Open the listening port
                        this.openPort()

                        // Init the Actions
                        this.initActions()
                        this.initVariables()
                        this.initFeedbacks()
                        this.initPresets()

                        this.checkVariables()
                        this.checkFeedbacks()

                        // Set Status to Connecting
                        this.updateStatus(InstanceStatus.Connecting)

                        this.setVariableValues({ module_state: 'Waiting for Data...' })
                }
        }
}

runEntrypoint(TSLProductsUMDListenerInstance, UpgradeScripts)
