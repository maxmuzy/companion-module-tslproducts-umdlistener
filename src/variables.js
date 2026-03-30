const TALLY_COLOR_NAMES = ['OFF', 'RED', 'GREEN', 'AMBER']

module.exports = {
        initVariables() {
                let self = this

                let variables = [{ name: 'Module State', variableId: 'module_state' }]

                for (let i = 0; i < self.TALLIES.length; i++) {
                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} Label`,
                                variableId: `tally_${self.TALLIES[i].address}_label`,
                        })
                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} PVW`,
                                variableId: `tally_${self.TALLIES[i].address}_pvw`,
                        })
                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} PGM`,
                                variableId: `tally_${self.TALLIES[i].address}_pgm`,
                        })

                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} Tally 1`,
                                variableId: `tally_${self.TALLIES[i].address}_tally1`,
                        })
                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} Tally 2`,
                                variableId: `tally_${self.TALLIES[i].address}_tally2`,
                        })
                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} Tally 3`,
                                variableId: `tally_${self.TALLIES[i].address}_tally3`,
                        })
                        variables.push({
                                name: `Tally ${self.TALLIES[i].address} Tally 4`,
                                variableId: `tally_${self.TALLIES[i].address}_tally4`,
                        })

                        if (self.config.protocol == 'tsl5.0') {
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} RH Tally`,
                                        variableId: `tally_${self.TALLIES[i].address}_rh_tally`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Text Tally`,
                                        variableId: `tally_${self.TALLIES[i].address}_text_tally`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} LH Tally`,
                                        variableId: `tally_${self.TALLIES[i].address}_lh_tally`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Brightness`,
                                        variableId: `tally_${self.TALLIES[i].address}_brightness`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Reserved`,
                                        variableId: `tally_${self.TALLIES[i].address}_reserved`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Control Data`,
                                        variableId: `tally_${self.TALLIES[i].address}_control_data`,
                                })
                        }

                        if (self.config.protocol == 'tsl4.0') {
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Brightness`,
                                        variableId: `tally_${self.TALLIES[i].address}_brightness`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} LH Tally L`,
                                        variableId: `tally_${self.TALLIES[i].address}_lh_tally_l`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Text Tally L`,
                                        variableId: `tally_${self.TALLIES[i].address}_text_tally_l`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} RH Tally L`,
                                        variableId: `tally_${self.TALLIES[i].address}_rh_tally_l`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} LH Tally R`,
                                        variableId: `tally_${self.TALLIES[i].address}_lh_tally_r`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} Text Tally R`,
                                        variableId: `tally_${self.TALLIES[i].address}_text_tally_r`,
                                })
                                variables.push({
                                        name: `Tally ${self.TALLIES[i].address} RH Tally R`,
                                        variableId: `tally_${self.TALLIES[i].address}_rh_tally_r`,
                                })
                        }
                }

                self.setVariableDefinitions(variables)
        },

        checkVariables() {
                let self = this

                try {
                        let variableObj = {}

                        for (let i = 0; i < self.TALLIES.length; i++) {
                                variableObj[`tally_${self.TALLIES[i].address}_label`] = self.TALLIES[i].label
                                variableObj[`tally_${self.TALLIES[i].address}_pvw`] = parseInt(self.TALLIES[i].tally1) == 1 ? 'True' : 'False'
                                variableObj[`tally_${self.TALLIES[i].address}_pgm`] = parseInt(self.TALLIES[i].tally2) == 1 ? 'True' : 'False'

                                variableObj[`tally_${self.TALLIES[i].address}_tally1`] =
                                        parseInt(self.TALLIES[i].tally1) == 1 ? 'True' : 'False'
                                variableObj[`tally_${self.TALLIES[i].address}_tally2`] =
                                        parseInt(self.TALLIES[i].tally2) == 1 ? 'True' : 'False'
                                variableObj[`tally_${self.TALLIES[i].address}_tally3`] =
                                        parseInt(self.TALLIES[i].tally3) == 1 ? 'True' : 'False'
                                variableObj[`tally_${self.TALLIES[i].address}_tally4`] =
                                        parseInt(self.TALLIES[i].tally4) == 1 ? 'True' : 'False'

                                if (self.config.protocol == 'tsl5.0') {
                                        variableObj[`tally_${self.TALLIES[i].address}_rh_tally`] = self.TALLIES[i].rh_tally
                                        variableObj[`tally_${self.TALLIES[i].address}_text_tally`] = self.TALLIES[i].text_tally
                                        variableObj[`tally_${self.TALLIES[i].address}_lh_tally`] = self.TALLIES[i].lh_tally
                                        variableObj[`tally_${self.TALLIES[i].address}_brightness`] = self.TALLIES[i].brightness
                                        variableObj[`tally_${self.TALLIES[i].address}_reserved`] = self.TALLIES[i].reserved
                                        variableObj[`tally_${self.TALLIES[i].address}_control_data`] = self.TALLIES[i].control_data
                                }

                                if (self.config.protocol == 'tsl4.0') {
                                        variableObj[`tally_${self.TALLIES[i].address}_brightness`] = self.TALLIES[i].brightness
                                        variableObj[`tally_${self.TALLIES[i].address}_lh_tally_l`] = TALLY_COLOR_NAMES[self.TALLIES[i].lh_tally_l] || 'OFF'
                                        variableObj[`tally_${self.TALLIES[i].address}_text_tally_l`] = TALLY_COLOR_NAMES[self.TALLIES[i].text_tally_l] || 'OFF'
                                        variableObj[`tally_${self.TALLIES[i].address}_rh_tally_l`] = TALLY_COLOR_NAMES[self.TALLIES[i].rh_tally_l] || 'OFF'
                                        variableObj[`tally_${self.TALLIES[i].address}_lh_tally_r`] = TALLY_COLOR_NAMES[self.TALLIES[i].lh_tally_r] || 'OFF'
                                        variableObj[`tally_${self.TALLIES[i].address}_text_tally_r`] = TALLY_COLOR_NAMES[self.TALLIES[i].text_tally_r] || 'OFF'
                                        variableObj[`tally_${self.TALLIES[i].address}_rh_tally_r`] = TALLY_COLOR_NAMES[self.TALLIES[i].rh_tally_r] || 'OFF'
                                }
                        }

                        self.setVariableValues(variableObj)
                } catch (error) {
                        if (self.config.verbose) {
                                self.log('debug', 'Error Updating Variables: ' + error)
                        }
                }
        },
}
