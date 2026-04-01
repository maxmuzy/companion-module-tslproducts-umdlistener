const { combineRgb } = require('@companion-module/base')

module.exports = {
        initPresets() {
                let self = this

                const foregroundColor = combineRgb(255, 255, 255) // White
                const backgroundColorGreen = combineRgb(0, 255, 0) // Green
                const backgroundColorRed = combineRgb(255, 0, 0) // Red

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

                }

                self.setPresetDefinitions(presets)
        },
}
