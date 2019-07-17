import Vue from 'vue'
import './style.css'
import axios from 'axios'
import { waitForTx } from '@waves/waves-transactions'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

const messages = {
	en: {
		title: 'Welcome to the Waves Community Lottery',
		shortDesc: 'Select one of 100 squares. Price: 1 WAVES or 1 WCT',
		description: `The winner will be determined when the last square is bought.<br/>
		The number of the winning square is the remainder of the last block's signature number on division by 100.<br/>
		(Number of winning square) = (Number of the last block's signature) % 100.<br/>
		10% will go to the creators`,
		round: 'Round',
		balance: 'Balance',
		lastWin: 'Last win',
		firstRound: 'none (first round)',
		gameAddress: 'Game address',
		github: 'Github',
		language: 'Language',
		selectAsset: 'Select asset',
		error: {
			keeper: 'Install WavesKeeper and restart page',
			network: 'Change network to MAINNET',
			locked: 'Unlock keeper',
			account: 'Create waves account'
		}
	},
	ru: {
		title: 'Добро пожаловать в Waves Community Lottery',
		shortDesc: 'Выберите один из 100 квадратов. Стоимость: 1 WAVES или 1 WCT',
		description: `Победитель будет определен при покупке последнего квадрата.<br/>
		Остаток от деления на 100 подписи последнего на этот момент блока блокчейна будет являться номером выигрышного квадрата.<br/>
		(Номер выигрышного квадрата) = (подпись последнего блока) % 100<br/>
		10% отправятся создателям`,
		round: 'Раунд',
		balance: 'Баланс',
		lastWin: 'Последний победитель',
		firstRound: 'нет (первый раунд)',
		gameAddress: 'Адрес игры',
		github: 'Github',
		language: 'Язык',
		selectAsset: 'Выберите ассет',
		error: {
			keeper: 'Установите WavesKeeper и обновите страницу',
			network: 'Смените сеть на MAINNET',
			locked: 'Разблокируйте keeper',
			account: 'Создайте waves аккаунт'
		}
	}
}

const i18n = new VueI18n({
	locale: localStorage.locale || 'en',
	messages,
	silentFallbackWarn: true
})

const main = new Vue({
	i18n,
	el: '#app',
	data: {
		langs: ['en', 'ru'],
		// node: 'https://pool.testnet.wavesnodes.com',
		node: 'https://nodes.wavesplatform.com',
		game: '3PA7R1CDJXWbzwKRTL98LQXn9Crb5XdHoHH',
		// game: '3PQM2vSdVDDDfNW8vkc3A2evpVzTYPMao1s',
		explorer: 'https://wavesexplorer.com',
		address: '',
		cells: [],
		round: 1,
		lastWin: {
			cell: 0,
			address: 'none'
		},
		asset: 'waves',
		assets: {
			waves: 'WAVES',
			wct: 'DHgwrRvVyqJsepd32YbBqUeDH4GJ1N984X8QoekjgH8J'
		},
		wvsBalance: 0,
		wctBalance: 0,
		status: {
			type: 'error',
			text: ''
		},
		disabled: false,
		init: false
	},
	created: function () {
		let arr = Array(100).fill({ round: 0 })
		this.cells = arr.slice(0)
		this.update()
		setInterval(this.update, 1000)
	},
	mounted: function () {
		if (localStorage.asset) {
			this.asset = localStorage.asset
		}
		// setTimeout(this.checkKeeper, 1000)
	},
	watch: {
		asset(asset) {
			localStorage.asset = asset
		},
		'$i18n.locale'(locale) {
			localStorage.locale = locale
		}
	},
	methods: {
		setStatus: function (type, text) {
			this.status.text = text
			this.status.type = type
		},
		listenKeeper: function (data) {
			if (!data.initialized) {
				this.setStatus('translate', 'error.account')
				return null
			}
			if (data.locked) {
				this.setStatus('translate', 'error.locked')
				return null
			}
			this.setStatus('', '')
			this.checkNetwork(data)
			this.address = data.account.address
		},
		parseKeeperErrors: function (error) {
			let errorText = error.message || 'Error';
			this.setStatus('', errorText);
		},
		checkKeeper: function () {
			if (!window.WavesKeeper) {
				this.setStatus('translate', 'error.keeper')
				return null
			}

			window.WavesKeeper.initialPromise.then(() => {
				window.WavesKeeper.on('update', this.listenKeeper)
				return window.WavesKeeper.publicState()
			}).then(
				this.listenKeeper,
				this.parseKeeperErrors
			)
		},
		update: async function () {
			const round = await this.getDataEntry('round')
			this.round = round.value
			const lastWin = await this.getDataEntry('lastWin')
			this.lastWin.cell = lastWin.value.split('_')[0]
			this.lastWin.address = lastWin.value.split('_')[1]
			const data = await this.getData()
			const cellsData = data
			.filter(item => {
				return Number(item.key) >= 0 && Number(item.key) <= 99
			})
			.map(item => {
				return {
					key: item.key,
					address: item.value.split('_')[0],
					round: item.value.split('_')[1]
				}
			})
			cellsData.forEach((item, i) => {
				this.cells.splice(item.key, 1, item)
			})
			this.getBalances()
		},
		getBalances: async function () {
			try {
				const wctResponse = await axios.get(`${this.node}/assets/balance/${this.game}/${this.assets.wct}`)
				const wvsResponse = await axios.get(`${this.node}/addresses/balance/${this.game}`)
				this.wctBalance = wctResponse.data.balance / 100
				this.wvsBalance = wvsResponse.data.balance / 100000000
			} catch (e) {
				console.log(e)
				this.setStatus('error', e)
			}
		},
		checkNetwork: function (data) {
			if (data.network.code !== 'W') {
				this.setStatus('translate', 'error.network')
				this.disabled = true
				return null
			}
			this.disabled = false
		},
		buy: async function (cell) {
			if (!this.init) {
				this.checkKeeper()
				this.init = true
			}
			const params = {
				type: 16,
				data: {
					fee: {
						assetId: 'WAVES',
						tokens: '0.005'
					},
					dApp: this.game,
					call: {
						args: [
						{
							type: 'integer',
							value: cell
						}
						],
						function: 'buy'
					},
					payment: [
					{
						tokens: '1',
						assetId: this.assets[this.asset]
					}
					]
				}
			}
			try {
				const result = await window.WavesKeeper.signAndPublishTransaction(params)
				const data = JSON.parse(result)
			} catch (e) {
				console.log(e)
				this.setStatus('error', e.message)
				}
			},
			getDataEntry: async function (key) {
				try {
					const response = await axios.get(`${this.node}/addresses/data/${this.game}/${key}`)
					return response.data
				} catch (e) {
					console.log(e)
					this.setStatus('error', e)
				}
			},
			getData: async function () {
				try {
					const response = await axios.get(`${this.node}/addresses/data/${this.game}`)
					return response.data
				} catch (e) {
					console.log(e)
					this.setStatus('error', e)
				}
			}
		}
	})