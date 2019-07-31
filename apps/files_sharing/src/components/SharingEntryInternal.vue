
<template>
	<SharingEntrySimple :title="t('files_sharing', 'Copy internal link')"
		:subtitle="internalLinkSubtitle">
		<template #avatar>
			<div class="avatar-external icon-external-white"></div>
		</template>
		<ActionLink :href="internalLink" target="_blank" icon="icon-clippy" @click.stop.prevent="copyLink">{{ clipboardTooltip }}</ActionLink>
	</SharingEntrySimple>
</template>

<script>
import { generateUrl } from 'nextcloud-router/dist/index'
import ActionLink from 'nextcloud-vue/dist/Components/ActionLink'
import SharingEntrySimple from './SharingEntrySimple'

export default {
	name: 'SharingEntryInternal',

	components: { 
		ActionLink,
		SharingEntrySimple
	},

	props: {
		fileInfo: {
			type: Object,
			default: () => {},
			required: true
		},
	},

	data() {
		return {
			copied: false,
			copySuccess: false
		}
	},

	computed: {
		/**
		 * Get the internal link to this file id
		 * @returns {string}
		 */
		internalLink() {
			return window.location.protocol + '//' + window.location.host + generateUrl('/f/') + this.fileInfo.id
		},
		
		/**
		 * Clipboard v-tooltip message 
		 * @returns {string}
		 */
		clipboardTooltip() {
			if (this.copied) {
				return this.copySuccess
					? t('files_sharing', 'Link copied')
					: t('files_sharing', 'Cannot copy, please copy the link manually')
			}
			return t('files_sharing', 'Copy to clipboard')
		},

		internalLinkSubtitle() {
			if (this.fileInfo.type === 'dir') {
				return t('files_sharing', 'Only works for users with access to this folder')
			}
			return t('files_sharing', 'Only works for users with access to this file')
		}
	},

	methods: {		
		async copyLink() {
			try {
				await this.$copyText(this.internalLink)
				this.copySuccess = true
				this.copied = true
			} catch (error) {
				this.copySuccess = false
				this.copied = true
				console.error(error);
			} finally {
				setTimeout(() => {
					this.copySuccess = false
					this.copied = false
				}, 4000)
			}
		}
	}
}
</script>

<style lang="scss" scoped>
.sharing-entry {
	display: flex;
	align-items: center;
	height: 44px;
	&__desc {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
		line-height: 1.2em;
		p {
			color: var(--color-text-maxcontrast);
		}
	}
	&__actions {
		margin-left: auto;
	}
	.avatar-external {
		width: 32px;
		height: 32px;
		line-height: 32px;
		font-size: 18px;
		background-color: var(--color-text-maxcontrast);
		border-radius: 50%;
		flex-shrink: 0;
	}
}
</style>
