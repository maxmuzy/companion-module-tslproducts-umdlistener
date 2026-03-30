const { fork } = require('child_process')
const path = require('path')
const crypto = require('crypto')

const CONNECTION_ID = 'test-connection-' + crypto.randomBytes(4).toString('hex')
const VERIFICATION_TOKEN = crypto.randomBytes(16).toString('hex')

console.log('Starting TSL Products UMD Listener module...')
console.log(`Connection ID: ${CONNECTION_ID}`)

const child = fork(path.join(__dirname, 'index.js'), [], {
	env: {
		...process.env,
		MODULE_MANIFEST: path.join(__dirname, 'companion/manifest.json'),
		CONNECTION_ID,
		VERIFICATION_TOKEN,
	},
	silent: false,
})

child.on('message', (msg) => {
	if (msg && msg.direction === 'call' && msg.name === 'register') {
		console.log('Module registered successfully with Companion host.')
		console.log('Module is running and ready to receive TSL UMD tally data.')
		child.send({
			direction: 'response',
			callId: msg.callId,
			payload: {},
		})
	} else {
		console.log('Module message:', JSON.stringify(msg))
	}
})

child.on('exit', (code) => {
	console.log(`Module process exited with code ${code}`)
	process.exit(code || 0)
})

child.on('error', (err) => {
	console.error('Module error:', err)
	process.exit(1)
})

process.on('SIGTERM', () => {
	child.kill('SIGTERM')
})

process.on('SIGINT', () => {
	child.kill('SIGTERM')
})

console.log('Module host ready. Waiting for module to register...')
