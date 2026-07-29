<script>
	// Outline icons, 24x24, stroked in currentColor so they inherit whatever the
	// surrounding text does. Kept in one file because there are few of them and
	// none are worth a network request.

	let { name, size = 18, stroke = 1.75, class: klass = '' } = $props();

	const paths = {
		board: 'M3 5h6v14H3zM10.5 5h3v9h-3zM15 5h6v14h-6z',
		list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
		sources:
			'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
		settings:
			'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.1a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.6 15H3.5a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0011 4.4V4.3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z',
		search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
		filter: 'M3 5h18l-7 8v6l-4 2v-8z',
		sort: 'M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3',
		plus: 'M12 5v14M5 12h14',
		check: 'M20 6L9 17l-5-5',
		x: 'M18 6L6 18M6 6l12 12',
		chevronLeft: 'M15 6l-6 6 6 6',
		chevronRight: 'M9 6l6 6-6 6',
		chevronDown: 'M6 9l6 6 6-6',
		note: 'M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zM9 8h6M9 12h6M9 16h3',
		activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
		clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
		warn: 'M12 3l9.5 16.5H2.5zM12 10v4M12 17.5h.01',
		link: 'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7',
		edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
		user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
		dots: 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
		refresh: 'M21 12a9 9 0 11-2.6-6.4M21 3v6h-6',
		inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.5h13l3.5 6.5v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5z',
		trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3',
		pause: 'M10 4H6v16h4zM18 4h-4v16h4z',
		ban: 'M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8',
		arrowRight: 'M5 12h14M13 6l6 6-6 6',
		undo: 'M3 8h11a5 5 0 010 10h-6M3 8l4-4M3 8l4 4'
	};
</script>

<svg
	class={klass}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={paths[name]} />
</svg>

<style lang="less">
	svg {
		flex: none;
		display: block;
	}
</style>
