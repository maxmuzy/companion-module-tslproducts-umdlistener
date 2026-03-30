const { combineRgb } = require('@companion-module/base')

module.exports = {
        initFeedbacks() {
                let self = this
                const feedbacks = {}

                const foregroundColorWhite = combineRgb(255, 255, 255) // White
                const backgroundColorRed = combineRgb(255, 0, 0) // Red

                feedbacks['tallyState'] = {
                        type: 'boolean',
                        name: 'Show Tally State On Button',
                        description: 'Indicate if Selected Address Tally is in X State',
                        defaultStyle: {
                                color: foregroundColorWhite,
                                bgcolor: backgroundColorRed,
                        },
                        options: [
                                {
                                        type: 'dropdown',
                                        label: 'Tally Address',
                                        id: 'address',
                                        default: self.CHOICES_TALLYADDRESSES[0].id,
                                        choices: self.CHOICES_TALLYADDRESSES,
                                },
                                {
                                        type: 'dropdown',
                                        label: 'Tally Number',
                                        id: 'number',
                                        default: 'tally2',
                                        choices: [
                                                { id: 'tally1', label: 'PVW' },
                                                { id: 'tally2', label: 'PGM' },
                                                { id: 'tally1', label: 'Tally 1' },
                                                { id: 'tally2', label: 'Tally 2' },
                                                { id: 'tally3', label: 'Tally 3' },
                                                { id: 'tally4', label: 'Tally 4' },
                                        ],
                                },
                                {
                                        type: 'dropdown',
                                        label: 'Indicate in X Status',
                                        id: 'state',
                                        default: 1,
                                        choices: [
                                                { id: 0, label: 'Off' },
                                                { id: 1, label: 'On' },
                                        ],
                                },
                        ],
                        callback: function (feedback) {
                                let opt = feedback.options

                                let tallyObj = self.TALLIES.find((tally) => parseInt(tally.address) == parseInt(opt.address))

                                if (tallyObj) {
                                        if (parseInt(tallyObj[opt.number]) == opt.state) {
                                                return true
                                        }
                                }

                                return false
                        },
                }

                feedbacks['tallyColorState'] = {
                        type: 'boolean',
                        name: 'Show V4.0 Tally Color State',
                        description: 'Indicate if a V4.0 color tally (LH/Text/RH for Display L or R) is in the selected color state',
                        defaultStyle: {
                                color: foregroundColorWhite,
                                bgcolor: backgroundColorRed,
                        },
                        options: [
                                {
                                        type: 'dropdown',
                                        label: 'Tally Address',
                                        id: 'address',
                                        default: self.CHOICES_TALLYADDRESSES[0].id,
                                        choices: self.CHOICES_TALLYADDRESSES,
                                },
                                {
                                        type: 'dropdown',
                                        label: 'Tally Type',
                                        id: 'tallyField',
                                        default: 'lh_tally_l',
                                        choices: [
                                                { id: 'lh_tally_l', label: 'LH Tally (Display L)' },
                                                { id: 'text_tally_l', label: 'Text Tally (Display L)' },
                                                { id: 'rh_tally_l', label: 'RH Tally (Display L)' },
                                                { id: 'lh_tally_r', label: 'LH Tally (Display R)' },
                                                { id: 'text_tally_r', label: 'Text Tally (Display R)' },
                                                { id: 'rh_tally_r', label: 'RH Tally (Display R)' },
                                        ],
                                },
                                {
                                        type: 'dropdown',
                                        label: 'Color State',
                                        id: 'colorState',
                                        default: 1,
                                        choices: [
                                                { id: 0, label: 'OFF' },
                                                { id: 1, label: 'RED' },
                                                { id: 2, label: 'GREEN' },
                                                { id: 3, label: 'AMBER' },
                                        ],
                                },
                        ],
                        callback: function (feedback) {
                                let opt = feedback.options

                                let tallyObj = self.TALLIES.find((tally) => parseInt(tally.address) == parseInt(opt.address))

                                if (tallyObj) {
                                        if (tallyObj[opt.tallyField] == opt.colorState) {
                                                return true
                                        }
                                }

                                return false
                        },
                }

                self.setFeedbackDefinitions(feedbacks)
        },
}
