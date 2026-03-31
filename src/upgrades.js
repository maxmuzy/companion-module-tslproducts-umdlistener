module.exports = [
	function (context, props) {
		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
	function (context, props) {
		const result = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		if (props.config) {
			const config = props.config
			if (config.ross_mle1_addr !== undefined && config.ross_mle_base_addr === undefined) {
				config.ross_mle_base_addr = parseInt(config.ross_mle1_addr) || 99
				config.ross_mle_count = 3
				delete config.ross_mle1_addr
				delete config.ross_mle2_addr
				delete config.ross_mle3_addr
				result.updatedConfig = config
			}
		}

		return result
	},
]
