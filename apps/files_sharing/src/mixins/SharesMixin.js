/**
 * @copyright Copyright (c) 2019 John Molakvoæ <skjnldsv@protonmail.com>
 *
 * @author John Molakvoæ <skjnldsv@protonmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { generateOcsUrl } from 'nextcloud-router/dist/index'
import axios from 'nextcloud-axios'
import PQueue from 'p-queue'
import debounce from 'debounce'

import Share from '../models/Share'
import Config from '../services/ConfigService'

const shareUrl = generateOcsUrl('apps/files_sharing/api/v1', 2) + 'shares'
const headers = {
	'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
};

export default {
	props: {
		fileInfo: {
			type: Object,
			default: () => {},
			required: true
		},
		share: {
			type: Share,
			default: null
		}
	},

	data() {
		return {
			config: new Config(),

			// errors helpers
			errors: {},
			errorTimeout: null,

			// component status toggles
			loading: false,
			saving: false,
			open: false,

			// concurrency management queue
			// we want one queue per share
			updateQueue: new PQueue({ concurrency: 1 }),

			/**
			 * ! This allow vue to make the Share class state reactive
			 * ! do not remove it ot you'll lose all reactivity here
			 */
			reactiveState: this.share && this.share.state,
		}
	},

	computed: {

		/**
		 * Does the current share have an expiration date
		 * @returns {boolean}
		 */
		hasExpirationDate: {
			get: function() {
				return this.config.isDefaultExpireDateEnforced || !!this.share.expireDate
			},
			set: function(enabled) {
				this.share.expireDate = enabled
					? this.config.defaultExpirationDateString !== ''
						? this.config.defaultExpirationDateString
						: moment().format('YYYY-MM-DD')
					: ''
			}
		},

		/**
		 * Does the current share have a note
		 * @returns {boolean}
		 */
		hasNote: {
			get: function() {
				return !!this.share.note
			},
			set: function(enabled) {
				this.share.note = enabled
					? t('files_sharing', 'Enter a note for the share recipient')
					: ''
			}
		},


		dateTomorrow() {
			return moment().add(1, 'days')
		},

		dateMaxEnforced() {
			return this.config.isDefaultExpireDateEnforced
				&& moment().add(1 + this.config.defaultExpireDate, 'days')
		},

		/**
		 * Datepicker lang values
		 * https://github.com/nextcloud/nextcloud-vue/pull/146
		 * TODO: have this in vue-components
		 */
		firstDay() {
			return window.firstDay
				? window.firstDay
				: 0 // sunday as default
		},
		lang() {
			// fallback to default in case of unavailable data
			return {
				days: window.dayNamesShort
					? window.dayNamesShort			// provided by nextcloud
					: ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'],
				months: window.monthNamesShort
					? window.monthNamesShort		// provided by nextcloud
					: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'],
				placeholder: {
					date: 'Select Date' // TODO: Translate
				}
			}
		}
	},

	methods: {

		/**
		 * Create a new share
		 *
		 * @param {Object} data destructuring object
		 * @param {string} data.path  path to the file/folder which should be shared
		 * @param {number} data.shareType  0 = user; 1 = group; 3 = public link; 6 = federated cloud share
		 * @param {string} data.shareWith  user/group id with which the file should be shared (optional for shareType > 1)
		 * @param {boolean} [data.publicUpload=false]  allow public upload to a public shared folder
		 * @param {string} [data.password]  password to protect public link Share with
		 * @param {number} [data.permissions=31]  1 = read; 2 = update; 4 = create; 8 = delete; 16 = share; 31 = all (default: 31, for public shares: 1)
		 * @param {boolean} [data.sendPasswordByTalk=false]
		 * @param {string} [data.expireDate='']
		 * @param {string} [data.label='']
		 * @returns {Share} the new share
		 * @throws {Error}
		 */
		async createShare({ path, permissions, shareType, shareWith, publicUpload, password, sendPasswordByTalk, expireDate, label }) {
			try {
				const request = await axios.post(shareUrl, { path, permissions, shareType, shareWith, publicUpload, password, sendPasswordByTalk, expireDate, label })
				return new Share(request.data.ocs.data)
			} catch (error) {
				console.error('Error while creating share', error);
				OC.Notification.showTemporary(t('files_sharing', 'Error creating the share'), { type: 'error'})
				throw error
			}
		},

		/**
		 * Delete a share
		 *
		 * @param {number} id 
		 * @throws {Error}
		 */
		async deleteShare(id) {
			try {
				await axios.delete(shareUrl + `/${id}`)
				return true
			} catch (error) {
				console.error('Error while deleting share', error);
				OC.Notification.showTemporary(t('files_sharing', 'Error deleting the share'), { type: 'error'})
				throw error
			}
		},

		/**
		 * Update a share
		 *
		 * @param {number} id 
		 * @param {Object} data 
		 * @param {string} data.property
		 * @param {any} data.value
		 */
		async updateShare(id, { property, value }) {
			try {
				// ocs api requires x-www-form-urlencoded
				const data = new URLSearchParams();
				data.append(property, value);
				
				await axios.put(shareUrl + `/${id}`, { [property]: value }, headers)
				return true
			} catch (error) {
				console.error('Error while updating share', error);
				OC.Notification.showTemporary(t('files_sharing', 'Error updating the share'), { type: 'error'})
				const message = error.response.data.ocs.meta.message
				throw { property, message }
			}
		},

		/**
		 * Check if a share is valid before
		 * firing the request
		 *
		 * @param {Share} share the share to check
		 * @returns {Boolean}
		 */
		checkShare(share) {
			if (share.password) {
				if (typeof share.password !== 'string' || share.password.trim() === '')  {
					return false
				}
			}
			if (share.expirationDate) {
				const date = moment(share.expirationDate)
				if (!date.isValid()) {
					return false
				}
			}
			return true
		},

		/**
		 * ActionInput can be a little tricky to work with.
		 * Since we expect a string and not a Date,
		 * we need to process the value here
		 */
		onExpirationChange(date) {
			// format to YYYY-MM-DD
			const value = moment(date).format('YYYY-MM-DD')
			this.share.expireDate = value
			this.queueUpdate('expireDate')
		},

		/**
		 * Uncheck expire date
		 * We need this method because @update:checked
		 * is ran simultaneously as @uncheck, so
		 * so we cannot ensure data is up-to-date
		 */
		onExpirationDisable() {
			this.share.expireDate = ''
			this.queueUpdate('expireDate')
		},

		/**
		 * Delete share button handler
		 */
		async onDelete() {
			try {
				this.loading = true
				this.open = false
				await this.deleteShare(this.share.id)
				console.debug('Share deleted', this.share.id);
				this.$emit('remove:share', this.share)
			} catch(error) {
				// re-open menu if error
				this.open = true
			} finally {
				this.loading = false
			}
		},

		/**
		 * Send an update of the share to the queue
		 *
		 * @param {string} property the property to sync
		 */
		queueUpdate(property) {
			const value = this.share[property]
			this.updateQueue.add(async () => {
				this.saving = true
				try {
					await this.updateShare(this.share.id, {
						property,
						value
					})

					// reset password state after sync
					if (property === 'password') {
						this.$delete(this.share, 'newPassword')
					}
					// clear any previous errors
					this.$delete(this.errors, property)
				} catch({ property, message }) {
					this.onSyncError(property, message)
				} finally {
					this.saving = false
				}
			})
		},

		/**
		 * Manage sync errors
		 * @param {string} property the errored property, e.g. 'password'
		 * @param {string} message the error message
		 */
		onSyncError(property, message) {
			// re-open menu if closed
			this.open = true
			switch (property) {
				case 'password':
				case 'pending':
				case 'expireDate':
				case 'note':
					// show error
					this.$set(this.errors, property, message)

					// Reset errors after  4 seconds
					clearTimeout(this.errorTimeout)
					this.errorTimeout = setTimeout(() => {
						this.errors = {}
					}, 4000)

					if (this.$refs[property]) {
						// focus if there is a focusable action element
						const focusable = this.$refs[property].querySelector('.focusable')
						if (focusable) {
							focusable.focus()
						}
					}
					break;
			}
		},

		/**
		 * Debounce queueUpdate to avoid requests spamming
		 * more importantly for text data
		 * 
		 * @param {string} property the property to sync
		 */
		debounceQueueUpdate: debounce(function(property) {
			this.queueUpdate(property)
		}, 500),
	}
}
