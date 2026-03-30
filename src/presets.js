const { combineRgb } = require('@companion-module/base')

module.exports = {
        initPresets() {
                let self = this

                const foregroundColor = combineRgb(255, 255, 255) // White
                const backgroundColorGreen = combineRgb(0, 255, 0) // Green
                const backgroundColorRed = combineRgb(255, 0, 0) // Red
                const backgroundColorAmber = combineRgb(255, 191, 0) // Amber

                const presets = []

                for (let i = 0; i < self.TALLIES.length; i++) {
                        presets.push({
                                type: 'button',
                                category: 'Tally State',
                                name: `${self.TALLIES[i].label} Tally State`,
                                style: {
                                        text: `$(tslumd-listener:tally_${self.TALLIES[i].address}_label)`,
                                        size: '18',
                                        color: '16777215',
                                        bgcolor: combineRgb(0, 0, 0),
                                },
                                steps: [],
                                feedbacks: [
                                        {
                                                feedbackId: 'tallyState',
                                                options: {
                                                        address: self.TALLIES[i].address,
                                                        number: 'tally1',
                                                        state: 1,
                                                },
                                                style: {
                                                        color: foregroundColor,
                                                        bgcolor: backgroundColorGreen,
                                                },
                                        },
                                        {
                                                feedbackId: 'tallyState',
                                                options: {
                                                        address: self.TALLIES[i].address,
                                                        number: 'tally2',
                                                        state: 1,
                                                },
                                                style: {
                                                        color: foregroundColor,
                                                        bgcolor: backgroundColorRed,
                                                },
                                        },
                                ],
                        })

                        if (self.config.protocol == 'tsl4.0') {
                                const v4TallyFields = [
                                        { field: 'lh_tally_l', label: 'LH L' },
                                        { field: 'text_tally_l', label: 'Txt L' },
                                        { field: 'rh_tally_l', label: 'RH L' },
                                        { field: 'lh_tally_r', label: 'LH R' },
                                        { field: 'text_tally_r', label: 'Txt R' },
                                        { field: 'rh_tally_r', label: 'RH R' },
                                ]

                                for (const tallyField of v4TallyFields) {
                                        presets.push({
                                                type: 'button',
                                                category: 'V4.0 Color Tally',
                                                name: `${self.TALLIES[i].label} ${tallyField.label}`,
                                                style: {
                                                        text: `$(tslumd-listener:tally_${self.TALLIES[i].address}_label)\n${tallyField.label}`,
                                                        size: '14',
                                                        color: '16777215',
                                                        bgcolor: combineRgb(0, 0, 0),
                                                },
                                                steps: [],
                                                feedbacks: [
                                                        {
                                                                feedbackId: 'tallyColorState',
                                                                options: {
                                                                        address: self.TALLIES[i].address,
                                                                        tallyField: tallyField.field,
                                                                        colorState: 1,
                                                                },
                                                                style: {
                                                                        color: foregroundColor,
                                                                        bgcolor: backgroundColorRed,
                                                                },
                                                        },
                                                        {
                                                                feedbackId: 'tallyColorState',
                                                                options: {
                                                                        address: self.TALLIES[i].address,
                                                                        tallyField: tallyField.field,
                                                                        colorState: 2,
                                                                },
                                                                style: {
                                                                        color: foregroundColor,
                                                                        bgcolor: backgroundColorGreen,
                                                                },
                                                        },
                                                        {
                                                                feedbackId: 'tallyColorState',
                                                                options: {
                                                                        address: self.TALLIES[i].address,
                                                                        tallyField: tallyField.field,
                                                                        colorState: 3,
                                                                },
                                                                style: {
                                                                        color: foregroundColor,
                                                                        bgcolor: backgroundColorAmber,
                                                                },
                                                        },
                                                ],
                                        })
                                }
                        }
                }

                self.setPresetDefinitions(presets)
        },
}
