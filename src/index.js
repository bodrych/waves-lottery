import Vue from 'vue'
import './style.css'
import axios from 'axios'
import { waitForTx } from '@waves/waves-transactions'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

const messages = {
	en: {
		title: 'Welcome to the Waves Community Lottery',
		shortDesc: 'Select one of 100 squares. Price: 1',
		description: `When the last square is bought out, you'll get the prize*, if number matches the signature of the last block.<br />
			You can buy any number of squares and increase your chances of winning.<br/>
			* 10% will go to the creators`,
		round: 'Round',
		balance: 'Balance',
		lastWin: 'Last win',
		firstRound: 'none (first round)',
		highlight: 'Highlight your squares',
		gameAddress: 'Game address',
		forumThread: 'How it works?',
		language: 'Language',
		keeperError: 'Waves Keeper is needed',
		networkError: 'Change network to TESTNET'
	},
	ru: {
		title: 'Добро пожаловать в Waves Community Lottery',
		shortDesc: 'Выберите один из 100 квадратов. Стоимость: 1',
		description: `Когда будет выкуплен последний квадрат, вы получите приз*, если номер соответствует сигнатуре последнего блока.<br />
			Вы можете купить любое количество квадратов и увеличить свой шанс на победу.<br/>
			* 10% отправятся создателям`,
		round: 'Раунд',
		balance: 'Баланс',
		lastWin: 'Последний победитель',
		firstRound: 'нет (первый раунд)',
		highlight: 'Выделить ваши ячейки',
		gameAddress: 'Адрес игры',
		forumThread: 'Как это работает?',
		language: 'Язык',
		keeperError: 'Необходим Waves Keeper',
		networkError: 'Смените сеть на TESTNET'
	}
}

const i18n = new VueI18n({
  locale: localStorage.locale || 'en',
  messages,
})

const main = new Vue({
	i18n,
	el: '#app',
	data: {
		langs: ['en', 'ru'],
		// node: 'https://pool.testnet.wavesnodes.com',
		node: 'https://nodes.wavesplatform.com',
		game: '3PA7R1CDJXWbzwKRTL98LQXn9Crb5XdHoHH',
		explorer: 'https://wavesexplorer.com',
		init: false,
		publicState: {
			account: {
				address: ''
			},
			network: {
				code: 'T'
			}
		},
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
		wctBalance: 0
	},
	created: function () {
		let arr = Array(100).fill({ round: 0 })
		this.cells = arr.slice(0)
		this.update()
		setInterval(this.update, 1000)
	},
	mounted: function () {
		setTimeout(this.checkKeeper(), 1000)
		if (localStorage.asset) {
			this.asset = localStorage.asset
		}
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
				throw e
			}
		},
		checkKeeper: function () {
			this.init = typeof window.WavesKeeper !== 'undefined'
			if (!this.init) {
				alert($t('keeperError'))
			}
		},
		checkNetwork: async function () {
			try {
				const publicState = await this.getPublicState()
				this.publicState = publicState
				if (publicState.network.code !== 'W')
					throw new Error(this.$t('networkError'))
			} catch (e) {
				throw e
			}
		},
		buy: async function (cell) {
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
				await this.checkNetwork()
				const result = await window.WavesKeeper.signAndPublishTransaction(params)
				const data = JSON.parse(result)
			} catch (e) {
				console.log(e)
				// if (e.code == 10)
					alert(e.message)
				// else
					// alert(e.data)
			}
		},
		getPublicState: async function () {
			try {
				const publicState = await window.WavesKeeper.publicState()
				return publicState
			} catch (e) {
				throw e
			}
		},
		getDataEntry: async function (key) {
			try {
				const response = await axios.get(`${this.node}/addresses/data/${this.game}/${key}`)
				return response.data
			} catch (e) {
				throw e
			}
		},
		getData: async function () {
			try {
				const response = await axios.get(`${this.node}/addresses/data/${this.game}`)
				return response.data
			} catch (e) {
				throw e
			}
		}
	}
})