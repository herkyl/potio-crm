<script>
	import { avatarColor, initials } from '$lib/format.js';

	let { name = '', id = '', size = 28 } = $props();
</script>

<span
	class="avatar"
	style:--avatar-bg={avatarColor(id || name)}
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{Math.round(size * 0.4)}px"
	title={name}
	aria-hidden="true"
>
	{initials(name)}
</span>

<style lang="less">
	.avatar {
		display: grid;
		place-items: center;
		flex: none;
		border-radius: var(--radius-pill);
		background: var(--avatar-bg);
		color: #ffffff;
		font-weight: var(--weight-semi);
		letter-spacing: 0.02em;
		user-select: none;
	}
</style>
