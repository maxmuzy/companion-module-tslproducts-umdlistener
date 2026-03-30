const { InstanceStatus } = require('@companion-module/base')

const dgram = require('dgram')
const net = require('net')

module.exports = {
        openPort() {
                let self = this

                const portType = self.config.porttype

                self.updateStatus(InstanceStatus.Connecting)

                this.closePort()

                try {
                        switch (portType) {
                                case 'udp':
                                        startUDP(self)
                                        break
                                case 'tcp':
                                        startTCP(self)
                                        break
                                default:
                                        self.log('error', 'Invalid port type specified. Please choose either UDP or TCP.')
                                        break
                        }

                        self.oldPortType = portType
                } catch (error) {
                        self.log('error', `Error occurred opening Tally listener port: ${error.toString()}`)
                        self.setVariableValues({ module_state: 'Error - See Log.' })
                        return
                }
        },

        closePort() {
                let self = this

                let port = self.config.port
                let portType = self.oldPortType == '' ? self.config.porttype : self.oldPortType

                if (self.SERVER !== undefined) {
                        try {
                                switch (portType) {
                                        case 'udp':
                                                self.log('info', `Closing TSL UMD UDP Port.`)
                                                self.SERVER.close()
                                                break
                                        case 'tcp':
                                                self.log('info', `Closing TSL UMD TCP Port.`)
                                                if (self.SERVER.server !== undefined) {
                                                        self.SERVER.server.close(function () {})
                                                }
                                                break
                                        default:
                                                break
                                }

                                self.SERVER = undefined
                        } catch (error) {
                                self.log('error', 'Error occurred closing Tally listener port: ' + error.toString())
                                self.setVariableValues({ module_state: 'Error - See Log.' })
                        }
                }
        },
}

function startUDP(self) {
        let port = self.config.port

        try {
                self.log('info', `Creating UDP Connection on Port: ${port}`)
                self.SERVER = dgram.createSocket('udp4')
                self.SERVER.bind(port)
                self.updateStatus(InstanceStatus.Ok)

                self.SERVER.on('error', function (err) {
                        if (err.code === 'EADDRINUSE') {
                                self.log('error', `Port ${port} is already in use. Make sure no other instance or service is using it.`)
                                self.updateStatus(InstanceStatus.ConnectionFailure, `Port ${port} is already in use.`)
                        } else {
                                self.log('error', `UDP socket error: ${err.message}`)
                                self.updateStatus(InstanceStatus.ConnectionFailure, err.stack)
                        }

                        self.SERVER.close()
                        self.SERVER = undefined
                        self.setVariableValues({ module_state: 'Error - See Log.' })
                })

                self.SERVER.on('listening', function () {
                        const address = self.SERVER.address()
                        self.log('info', `UDP Server is listening on ${address.address}:${address.port}`)
                        self.updateStatus(InstanceStatus.Ok)
                        self.setVariableValues({ module_state: 'Listening on UDP, Waiting for Data...' })
                })

                self.SERVER.on('message', function (message, rinfo) {
                        self.log('debug', `Received data: ${message.toString('hex')}`)
                        self.setVariableValues({ module_state: 'Tally Data Received.' })

                        if (self.config.protocol == 'tsl3.1') {
                                parseTSL31Packet(self, message)
                        } else if (self.config.protocol == 'tsl4.0') {
                                parseTSL4Packet(self, message)
                        } else if (self.config.protocol == 'tsl5.0') {
                                parseTSL5Packet(self, message)
                        }
                })
        } catch (error) {
                self.log('error', `TSL UDP Server Error occurred: ${error}`)
                self.setVariableValues({ module_state: 'Error - See Log.' })
                return
        }
}

function startTCP(self) {
        let port = self.config.port

        try {
                self.log('info', `Creating TCP Connection on Port: ${port}`)
                self.SERVER = net.createServer(function (socket) {
                        socket.on('data', function (data) {
                                self.log('debug', `Received data: ${data.toString('hex')}`)
                                self.setVariableValues({ module_state: 'Tally Data Received.' })

                                if (self.config.protocol == 'tsl3.1') {
                                        parseTSL31Packet(self, data)
                                } else if (self.config.protocol == 'tsl4.0') {
                                        parseTSL4Packet(self, data)
                                } else if (self.config.protocol == 'tsl5.0') {
                                        parseTSL5Packet(self, data)
                                }
                        })

                        socket.on('close', function () {
                                self.log('debug', `TSL TCP Server connection closed.`)
                        })

                        self.log('debug', `TSL TCP Server connection opened.`)
                        self.updateStatus(InstanceStatus.Ok)
                })

                self.SERVER.on('error', function (error) {
                        if (error.code === 'EADDRINUSE') {
                                self.log('error', `TCP port ${port} is already in use.`)
                        } else {
                                self.log('error', `TCP server error: ${error.message}`)
                        }
                        self.updateStatus(InstanceStatus.Error)
                        self.setVariableValues({ module_state: 'Error - See Log.' })
                })

                self.SERVER.on('listening', function () {
                        const address = self.SERVER.address()
                        self.log('info', `TCP Server is listening on ${address.address}:${address.port}`)
                        self.updateStatus(InstanceStatus.Ok)
                        self.setVariableValues({ module_state: 'Listening on TCP' })
                })

                self.SERVER.listen(port)
        } catch (error) {
                self.log('error', `TSL TCP Server Error occurred: ${error}`)
                self.setVariableValues({ module_state: 'Error - See Log.' })
        }
}

function parseTSL31Packet(self, buffer) {
        if (buffer.length < 18) return

        // Byte 0: 0x80 + address
        const address = buffer.readUInt8(0) - 0x80

        // Byte 1: brightness + tally bits
        const byte1 = buffer.readUInt8(1)

        const brightness = (byte1 >> 6) & 0b11 // Bits 7-6

        const tally1 = (byte1 >> 0) & 0b1
        const tally2 = (byte1 >> 1) & 0b1
        const tally3 = (byte1 >> 2) & 0b1
        const tally4 = (byte1 >> 3) & 0b1

        // Bytes 2–17: label (16 bytes ASCII, padded with nulls)
        const label = buffer.slice(2, 18).toString('ascii').replace(/\0/g, '').trim()

        const tallyObj = {
                address,
                tally1,
                tally2,
                tally3,
                tally4,
                brightness,
                label,
        }

        console.log('Parsed TSL 3.1 packet:', tallyObj)

        processTSLTallyObj(self, tallyObj)
}

function parseTSL4Packet(self, buffer) {
        if (buffer.length < 18) {
                self.log('warn', 'Received TSL 4.0 packet is too short (less than 18 bytes).')
                return
        }

        const address = buffer.readUInt8(0) - 0x80
        const ctrl = buffer.readUInt8(1)

        const isCommand = (ctrl >> 6) & 0b1
        if (isCommand) {
                self.log('debug', 'TSL 4.0 command message received, skipping (not supported).')
                return
        }

        const tally1 = (ctrl >> 0) & 0b1
        const tally2 = (ctrl >> 1) & 0b1
        const tally3 = (ctrl >> 2) & 0b1
        const tally4 = (ctrl >> 3) & 0b1
        const brightness = (ctrl >> 4) & 0b11

        const label = buffer.slice(2, 18).toString('ascii').replace(/\0/g, '').trim()

        let lh_tally_l = 0
        let text_tally_l = 0
        let rh_tally_l = 0
        let lh_tally_r = 0
        let text_tally_r = 0
        let rh_tally_r = 0

        if (buffer.length >= 20) {
                let sum = 0
                for (let i = 0; i < 18; i++) {
                        sum += buffer.readUInt8(i)
                }
                const expectedChecksum = ((~sum + 1) & 0xff) % 128
                const receivedChecksum = buffer.readUInt8(18)

                if (expectedChecksum !== receivedChecksum) {
                        self.log('warn', `TSL 4.0 checksum mismatch: expected ${expectedChecksum}, got ${receivedChecksum}. Processing anyway.`)
                }

                const vbc = buffer.readUInt8(19)
                const minorVersion = (vbc >> 4) & 0b111
                const xdataLength = vbc & 0b1111

                if (minorVersion !== 0) {
                        self.log('debug', `TSL 4.0 minor version ${minorVersion} detected, parsing as V4.0.`)
                }

                if (xdataLength >= 2 && buffer.length >= 20 + xdataLength) {
                        const xbyte1 = buffer.readUInt8(20)
                        const xbyte2 = buffer.readUInt8(21)

                        lh_tally_l = (xbyte1 >> 4) & 0b11
                        text_tally_l = (xbyte1 >> 2) & 0b11
                        rh_tally_l = xbyte1 & 0b11

                        lh_tally_r = (xbyte2 >> 4) & 0b11
                        text_tally_r = (xbyte2 >> 2) & 0b11
                        rh_tally_r = xbyte2 & 0b11
                } else {
                        self.log('debug', 'TSL 4.0 XDATA not present or too short, using V3.1 data only.')
                }
        } else {
                self.log('debug', 'TSL 4.0 packet has no extended data, parsing as V3.1 compatible.')
        }

        const tallyObj = {
                address,
                tally1,
                tally2,
                tally3,
                tally4,
                brightness,
                label,
                lh_tally_l,
                text_tally_l,
                rh_tally_l,
                lh_tally_r,
                text_tally_r,
                rh_tally_r,
        }

        if (self.config.verbose) {
                console.log('Parsed TSL 4.0 packet:', tallyObj)
        }

        processTSLTallyObj(self, tallyObj)
}

function parseTSL5Packet(self, data) {
        console.log('Raw TSL5 Packet:', data.toString('hex'))

        // Handle DLE/STX framing if present
        if (data[0] === 0xfe && data[1] === 0x02) {
                data = data.slice(2)

                // Un-stuff DLE bytes (0xfe 0xfe → 0xfe)
                let clean = []
                for (let i = 0; i < data.length; i++) {
                        if (data[i] === 0xfe && data[i + 1] === 0xfe) {
                                clean.push(0xfe)
                                i++ // skip next byte
                        } else {
                                clean.push(data[i])
                        }
                }
                data = Buffer.from(clean)
        }

        if (data.length < 12) {
                self.log('warn', 'Received TSL 5.0 packet is too short.')
                return
        }

        const PBC = data.readUInt16LE(0)
        const VAR = data.readUInt8(2)
        const FLAGS = data.readUInt8(3)
        const SCREEN = data.readUInt16LE(4)
        const INDEX = data.readUInt16LE(6)
        const CONTROL = data.readUInt16LE(8)
        const LENGTH = data.readUInt16LE(10)

        if (data.length < 12 + LENGTH) {
                self.log('warn', 'Received TSL 5.0 packet length mismatch.')
                return
        }

        const TEXT = data
                .slice(12, 12 + LENGTH)
                .toString('ascii')
                .replace(/\0/g, '')
                .trim()

        const control = {
                rh_tally: (CONTROL >> 0) & 0b11,
                text_tally: (CONTROL >> 2) & 0b11,
                lh_tally: (CONTROL >> 4) & 0b11,
                brightness: (CONTROL >> 6) & 0b11,
                reserved: (CONTROL >> 8) & 0b1111111,
                control_data: (CONTROL >> 15) & 0b1,
        }

        let inPreview = 0
        let inProgram = 0

        switch (control.text_tally) {
                case 1:
                        inProgram = 1
                        break
                case 2:
                        inPreview = 1
                        break
                case 3:
                        inProgram = 1
                        inPreview = 1
                        break
        }

        const newTallyObj = {
                tally1: inPreview,
                tally2: inProgram,
                address: INDEX,
                label: TEXT,
                rh_tally: control.rh_tally,
                text_tally: control.text_tally,
                lh_tally: control.lh_tally,
                brightness: control.brightness,
                reserved: control.reserved,
                control_data: control.control_data,
        }

        console.log(newTallyObj)

        processTSLTallyObj(self, newTallyObj)
}

function processTSLTallyObj(self, tally) {
        let found = false

        //console.log('processing TSL packet:', tally)

        self.TALLIES = self.TALLIES || []
        self.CHOICES_TALLYADDRESSES = self.CHOICES_TALLYADDRESSES || []

        if (self.CHOICES_TALLYADDRESSES.length > 0 && self.CHOICES_TALLYADDRESSES[0].id == -1) {
                //if the choices list is still set to default, go ahead and reset it
                self.CHOICES_TALLYADDRESSES = []
        }

        for (let i = 0; i < self.TALLIES.length; i++) {
                if (self.TALLIES[i].address == tally.address) {
                        self.TALLIES[i].tally1 = tally.tally1
                        self.TALLIES[i].tally2 = tally.tally2
                        self.TALLIES[i].label = tally.label.trim().replace(self.config.filter, '')
                        if (self.config.protocol == 'tsl5.0') {
                                self.TALLIES[i].rh_tally = tally.rh_tally
                                self.TALLIES[i].text_tally = tally.text_tally
                                self.TALLIES[i].lh_tally = tally.lh_tally
                                self.TALLIES[i].brightness = tally.brightness
                                self.TALLIES[i].reserved = tally.reserved
                                self.TALLIES[i].control_data = tally.control_data
                        }
                        if (self.config.protocol == 'tsl4.0') {
                                self.TALLIES[i].tally3 = tally.tally3
                                self.TALLIES[i].tally4 = tally.tally4
                                self.TALLIES[i].brightness = tally.brightness
                                self.TALLIES[i].lh_tally_l = tally.lh_tally_l
                                self.TALLIES[i].text_tally_l = tally.text_tally_l
                                self.TALLIES[i].rh_tally_l = tally.rh_tally_l
                                self.TALLIES[i].lh_tally_r = tally.lh_tally_r
                                self.TALLIES[i].text_tally_r = tally.text_tally_r
                                self.TALLIES[i].rh_tally_r = tally.rh_tally_r
                        }
                        found = true
                        break
                }
        }

        if (!found) {
                let tallyObj = {}
                tallyObj.address = tally.address
                tallyObj.tally1 = tally.tally1
                tallyObj.tally2 = tally.tally2
                tallyObj.tally3 = tally.tally3
                tallyObj.tally4 = tally.tally4
                tallyObj.label = tally.label.trim().replace(self.config.filter, '')

                if (self.config.protocol == 'tsl5.0') {
                        tallyObj.rh_tally = tally.rh_tally
                        tallyObj.text_tally = tally.text_tally
                        tallyObj.lh_tally = tally.lh_tally
                        tallyObj.brightness = tally.brightness
                        tallyObj.reserved = tally.reserved
                        tallyObj.control_data = tally.control_data
                }

                if (self.config.protocol == 'tsl4.0') {
                        tallyObj.brightness = tally.brightness
                        tallyObj.lh_tally_l = tally.lh_tally_l
                        tallyObj.text_tally_l = tally.text_tally_l
                        tallyObj.rh_tally_l = tally.rh_tally_l
                        tallyObj.lh_tally_r = tally.lh_tally_r
                        tallyObj.text_tally_r = tally.text_tally_r
                        tallyObj.rh_tally_r = tally.rh_tally_r
                }

                self.TALLIES.push(tallyObj)
                self.TALLIES.sort((a, b) => a.address - b.address)

                self.CHOICES_TALLYADDRESSES.push({
                        id: tally.address,
                        label: tally.address + ' (' + tally.label.trim().replace(self.config.filter, '') + ')',
                })

                self.CHOICES_TALLYADDRESSES.sort((a, b) => a.id - b.id)

                self.initVariables()
                self.initFeedbacks()
                self.initPresets()
        }

        self.updateStatus(InstanceStatus.Ok)
        self.setVariableValues({ module_state: 'Tally Data Received.' })

        self.checkVariables()
        self.checkFeedbacks()
}
