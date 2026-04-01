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
                        self.log('error', `Error occurred opening Serial Tally listener port: ${error.toString()}`)
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
                                                self.log('info', `Closing Serial Tally UDP Port.`)
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
                                self.log('error', 'Error occurred closing Serial Tally listener port: ' + error.toString())
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

                        if (self.config.protocol == 'rossvision') {
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

                                if (self.config.protocol == 'rossvision') {
                                        processRossVisionTCPData(self, data)
                                }
                        })

                        socket.on('close', function () {
                                self.log('debug', `Serial Tally TCP Server connection closed.`)
                        })

                        self.log('debug', `Serial Tally TCP Server connection opened.`)
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
                self.log('error', `Serial Tally TCP Server Error occurred: ${error}`)
                self.setVariableValues({ module_state: 'Error - See Log.' })
        }
}

function getRossMleCount(self) {
        const count = parseInt(self.config.ross_mle_count) || 3; return Math.max(1, Math.min(3, count))
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
	for (let i = count + 1; i <= 3; i++) {
		delete self.ROSS_MLE_STATE[`mle${i}`]
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
