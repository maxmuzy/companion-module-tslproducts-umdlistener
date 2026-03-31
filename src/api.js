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
                        } else if (self.config.protocol == 'rossvision') {
                                parseRossVisionPacket(self, message)
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
                                } else if (self.config.protocol == 'rossvision') {
                                        processRossVisionTCPData(self, data)
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

function getRossMleCount(self) {
        return parseInt(self.config.ross_mle_count) || 3
}

function getRossExpectedB1Size(self) {
        return 74 + (getRossMleCount(self) * 25) + 76
}

function getRossMleAddrMap(self) {
        const count = getRossMleCount(self)
        const base = parseInt(self.config.ross_mle_base_addr) || 99
        const map = {}
        for (let i = 1; i <= count; i++) {
                map[`mle${i}`] = base + (i - 1) * 6
        }
        return map
}

function processRossVisionTCPData(self, data) {
        if (!self.ROSS_TCP_BUFFER) {
                self.ROSS_TCP_BUFFER = Buffer.alloc(0)
        }

        self.ROSS_TCP_BUFFER = Buffer.concat([self.ROSS_TCP_BUFFER, data])

        const expectedB1Size = getRossExpectedB1Size(self)

        while (self.ROSS_TCP_BUFFER.length >= 2) {
                const b0 = self.ROSS_TCP_BUFFER[0]
                const b1 = self.ROSS_TCP_BUFFER[1]

                if (b0 === 0xc1 && b1 === 0xc1) {
                        if (self.ROSS_TCP_BUFFER.length < 21) break
                        const packet = self.ROSS_TCP_BUFFER.slice(0, 21)
                        self.ROSS_TCP_BUFFER = self.ROSS_TCP_BUFFER.slice(21)
                        parseRossVisionPacket(self, packet)
                } else if (b0 === 0xb1 && b1 === 0xb1) {
                        if (self.ROSS_TCP_BUFFER.length < expectedB1Size) break
                        const packet = self.ROSS_TCP_BUFFER.slice(0, expectedB1Size)
                        self.ROSS_TCP_BUFFER = self.ROSS_TCP_BUFFER.slice(expectedB1Size)
                        parseRossVisionPacket(self, packet)
                } else {
                        if (self.config.verbose) {
                                self.log('debug', `Ross Vision TCP: Skipping unknown byte 0x${b0.toString(16)}`)
                        }
                        self.ROSS_TCP_BUFFER = self.ROSS_TCP_BUFFER.slice(1)
                }
        }
}

function parseRossVisionPacket(self, buffer) {
        const len = buffer.length
        const mleCount = getRossMleCount(self)
        const expectedB1Size = getRossExpectedB1Size(self)

        if (len === 21 && buffer[0] === 0xc1 && buffer[1] === 0xc1) {
                const address = buffer.readUInt8(2)
                const label = buffer.slice(3, 21).toString('ascii').replace(/\0/g, '').trim()

                if (self.config.verbose) {
                        self.log('info', `Ross Vision Label: addr=${address} label="${label}"`)
                }

                self.ROSS_LABELS = self.ROSS_LABELS || {}
                self.ROSS_LABELS[address] = label

                const existing = self.TALLIES.find((t) => t.address === address)
                const currentTally1 = existing ? existing.tally1 : 0
                const currentTally2 = existing ? existing.tally2 : 0

                processTSLTallyObj(self, {
                        address: address,
                        tally1: currentTally1,
                        tally2: currentTally2,
                        tally3: 0,
                        tally4: 0,
                        label: label,
                })
        } else if (len === expectedB1Size && buffer[0] === 0xb1 && buffer[1] === 0xb1) {
                initRossMleState(self)

                const labels = self.ROSS_LABELS || {}
                const fmt = (addr) => labels[addr] ? `${addr} (${labels[addr]})` : `${addr}`

                for (let i = 1; i <= mleCount; i++) {
                        const blockStart = 74 + (mleCount - i) * 25
                        const mleName = `mle${i}`

                        const pgm = buffer.readUInt8(blockStart + 16)
                        const pvw = buffer.readUInt8(blockStart + 18)
                        const keyStatusByte = buffer.readUInt8(blockStart + 3)
                        const key1Src = buffer.readUInt8(blockStart + 0)
                        const key2Src = buffer.readUInt8(blockStart + 4)
                        const key3Src = buffer.readUInt8(blockStart + 8)
                        const key4Src = buffer.readUInt8(blockStart + 12)

                        const key1Active = (keyStatusByte & 0x10) !== 0
                        const key2Active = (keyStatusByte & 0x20) !== 0
                        const key3Active = (keyStatusByte & 0x40) !== 0
                        const key4Active = (keyStatusByte & 0x80) !== 0

                        self.ROSS_MLE_STATE[mleName].pgm = pgm
                        self.ROSS_MLE_STATE[mleName].pvw = pvw
                        self.ROSS_MLE_STATE[mleName].key1Src = key1Src
                        self.ROSS_MLE_STATE[mleName].key2Src = key2Src
                        self.ROSS_MLE_STATE[mleName].key3Src = key3Src
                        self.ROSS_MLE_STATE[mleName].key4Src = key4Src
                        self.ROSS_MLE_STATE[mleName].key1Active = key1Active
                        self.ROSS_MLE_STATE[mleName].key2Active = key2Active
                        self.ROSS_MLE_STATE[mleName].key3Active = key3Active
                        self.ROSS_MLE_STATE[mleName].key4Active = key4Active
				self.ROSS_MLE_STATE[mleName].keyActiveMask = keyStatusByte

                        if (self.config.verbose) {
                                const keySummary = [1, 2, 3, 4].map((k) => {
                                        const active = self.ROSS_MLE_STATE[mleName][`key${k}Active`]
                                        const src = self.ROSS_MLE_STATE[mleName][`key${k}Src`]
                                        return `KEY${k}=${fmt(src)}${active ? ' [ON]' : ''}`
                                }).join(', ')
                                self.log(
                                        'info',
                                        `Ross Vision ${mleName.toUpperCase()} (block@${blockStart}): PGM=${fmt(pgm)} PVW=${fmt(pvw)} | ${keySummary} | keyMask=0x${keyStatusByte.toString(16).padStart(2, '0')}`
                                )
                        }
                }

                let mainMle = self.config.ross_main_mle || 'mle1'
                const mainNum = parseInt(mainMle.replace('mle', ''))
                if (isNaN(mainNum) || mainNum < 1 || mainNum > mleCount) {
                        if (self.config.verbose) {
                                self.log('warn', `Ross Vision: Main MLE "${mainMle}" is out of range for ${mleCount} MLEs, defaulting to MLE1`)
                        }
                        mainMle = 'mle1'
                }
                const mainState = self.ROSS_MLE_STATE[mainMle]

                const mleAddrMap = getRossMleAddrMap(self)

                if (self.config.verbose) {
                        const addrList = Object.entries(mleAddrMap).map(([m, a]) => `${m.toUpperCase()}=${a}`).join(', ')
                        self.log(
                                'info',
                                `Ross Vision Config: Main=${mainMle.toUpperCase()} | Source addresses: ${addrList}`
                        )
                }

                const pgmCascade = new Set()
                const pvwCascade = new Set()

                pgmCascade.add(mainState.pgm)
                pvwCascade.add(mainState.pvw)

                for (let k = 1; k <= 4; k++) {
                        if (mainState[`key${k}Active`]) {
                                const keySrc = mainState[`key${k}Src`]
                                pgmCascade.add(keySrc)
                                if (self.config.verbose) {
                                        self.log('info', `Ross Vision Cascade: ${mainMle.toUpperCase()} KEY${k}=${fmt(keySrc)} [ON] -> adding to PGM tally`)
                                }
                        }
                }

                if (self.config.verbose) {
                        self.log(
                                'info',
                                `Ross Vision Cascade: ${mainMle.toUpperCase()} direct -> PGM=${fmt(mainState.pgm)}, PVW=${fmt(mainState.pvw)}`
                        )
                }

                for (let i = 1; i <= mleCount; i++) {
                        const mle = `mle${i}`
                        if (mle === mainMle) continue
                        const mleAddr = mleAddrMap[mle]

                        const secState = self.ROSS_MLE_STATE[mle]

                        if (mainState.pgm === mleAddr) {
                                pgmCascade.add(secState.pgm)
                                for (let k = 1; k <= 4; k++) {
                                        if (secState[`key${k}Active`]) {
                                                pgmCascade.add(secState[`key${k}Src`])
                                                if (self.config.verbose) {
                                                        self.log('info', `Ross Vision Cascade: ${mle.toUpperCase()} KEY${k}=${fmt(secState[`key${k}Src`])} [ON] -> adding to PGM tally (via cascade)`)
                                                }
                                        }
                                }
                                if (self.config.verbose) {
                                        self.log(
                                                'info',
                                                `Ross Vision Cascade: ${mle.toUpperCase()} (addr=${mleAddr}) is on ${mainMle.toUpperCase()} PGM -> adding PGM=${fmt(secState.pgm)} to PGM tally`
                                        )
                                }
                        }

                        if (mainState.pvw === mleAddr) {
                                pvwCascade.add(secState.pvw)
                                for (let k = 1; k <= 4; k++) {
                                        if (secState[`key${k}Active`]) {
                                                pvwCascade.add(secState[`key${k}Src`])
                                                if (self.config.verbose) {
                                                        self.log('info', `Ross Vision Cascade: ${mle.toUpperCase()} KEY${k}=${fmt(secState[`key${k}Src`])} [ON] -> adding to PVW tally (via cascade)`)
                                                }
                                        }
                                }
                                if (self.config.verbose) {
                                        self.log(
                                                'info',
                                                `Ross Vision Cascade: ${mle.toUpperCase()} (addr=${mleAddr}) is on ${mainMle.toUpperCase()} PVW -> adding PVW=${fmt(secState.pvw)} to PVW tally`
                                        )
                                }
                        }

                        if (mainState.pgm !== mleAddr && mainState.pvw !== mleAddr) {
                                if (self.config.verbose) {
                                        self.log(
                                                'debug',
                                                `Ross Vision Cascade: ${mle.toUpperCase()} (addr=${mleAddr}) is NOT on ${mainMle.toUpperCase()} PGM(${mainState.pgm}) or PVW(${mainState.pvw}) -> no cascade`
                                        )
                                }
                        }
                }

                pgmCascade.delete(0)
                pvwCascade.delete(0)

                if (self.config.verbose) {
                        const fmtSet = (s) => [...s].map((a) => fmt(a)).join(', ')
                        self.log(
                                'info',
                                `Ross Vision Tally Result: PGM=[${fmtSet(pgmCascade)}] | PVW=[${fmtSet(pvwCascade)}]`
                        )
                }

                const allAddresses = new Set()
                for (const t of self.TALLIES) {
                        allAddresses.add(t.address)
                }
                pgmCascade.forEach((a) => allAddresses.add(a))
                pvwCascade.forEach((a) => allAddresses.add(a))

                for (const addr of allAddresses) {
                        const newTally2 = pgmCascade.has(addr) ? 1 : 0
                        const newTally1 = pvwCascade.has(addr) ? 1 : 0

                        const existing = self.TALLIES.find((t) => t.address === addr)
                        if (existing && existing.tally1 === newTally1 && existing.tally2 === newTally2) {
                                continue
                        }

                        const label = labels[addr] || `Source ${addr}`

                        if (self.config.verbose) {
                                const oldT1 = existing ? existing.tally1 : '-'
                                const oldT2 = existing ? existing.tally2 : '-'
                                self.log(
                                        'info',
                                        `Ross Vision Tally Change: addr=${addr} (${label}) PVW: ${oldT1}->${newTally1} | PGM: ${oldT2}->${newTally2}`
                                )
                        }

                        processTSLTallyObj(self, {
                                address: addr,
                                tally1: newTally1,
                                tally2: newTally2,
                                tally3: 0,
                                tally4: 0,
                                label: label,
                        })
                }

                self.checkVariables()
                self.checkFeedbacks()
        } else {
                if (self.config.verbose) {
                        self.log('debug', `Ross Vision: Ignoring packet of ${len} bytes (expected B1=${expectedB1Size}, header: 0x${buffer[0].toString(16)} 0x${buffer[1].toString(16)})`)
                }
        }
}

function initRossMleState(self) {
        const count = getRossMleCount(self)
        if (!self.ROSS_MLE_STATE) {
                self.ROSS_MLE_STATE = {}
        }
        for (let i = 1; i <= count; i++) {
                const mleName = `mle${i}`
                if (!self.ROSS_MLE_STATE[mleName]) {
                        self.ROSS_MLE_STATE[mleName] = {
                                pgm: 0, pvw: 0,
                                key1Src: 0, key2Src: 0, key3Src: 0, key4Src: 0,
                                key1Active: false, key2Active: false, key3Active: false, key4Active: false,
                        }
                }
        }
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
