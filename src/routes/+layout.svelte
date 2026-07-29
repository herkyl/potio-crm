<script>
	import '../style/main.less';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
	/>
</svelte:head>

<div class="frame">
	<Sidebar counts={data.counts} />
	<main>
		{@render children()}
	</main>
</div>

<style lang="less">
	/* The app fills the viewport edge to edge — no inset canvas behind it. The
	   surface hierarchy still holds inside: white app, faint gray columns, white
	   cards (SPEC §6.3). */
	.frame {
		display: flex;
		height: 100vh;
		overflow: hidden;
		background: var(--bg-app);
	}

	main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
