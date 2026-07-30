<script>
	import { page } from '$app/state';
	import Icon from './Icon.svelte';

	let { counts = {} } = $props();

	let collapsed = $state(false);

	const groups = [
		{
			label: 'Pipeline',
			items: [
				{ href: '/board', icon: 'board', label: 'Board', count: () => counts.open },
				{ href: '/list', icon: 'list', label: 'List' }
			]
		},
		{
			label: 'Intake',
			items: [{ href: '/sources', icon: 'sources', label: 'Sources', count: () => counts.newLeads }]
		}
	];

	// `/board/[id]` opens a modal over the board, so the Board item stays active.
	const isActive = (href) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<aside class="sidebar" class:collapsed>
	<div class="brand">
		<span class="wordmark">potio<span class="dim">crm</span></span>
		<button
			class="collapse"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
		</button>
	</div>

	<nav>
		{#each groups as group}
			<div class="group">
				<p class="group-label">{group.label}</p>
				<ul>
					{#each group.items as item}
						{@const active = isActive(item.href)}
						{@const count = item.count?.()}
						<li>
							<a
								href={item.href}
								class="nav-item"
								class:active
								title={item.label}
								aria-current={active ? 'page' : undefined}
							>
								<Icon name={item.icon} size={18} />
								<span class="label">{item.label}</span>
								{#if count}<span class="count">{count}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<div class="foot">
		<a href="/settings" class="nav-item" class:active={isActive('/settings')} title="Settings">
			<Icon name="settings" size={18} />
			<span class="label">Settings</span>
		</a>
	</div>
</aside>

<style lang="less">
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 240px;
		flex: none;
		padding: var(--space-4) var(--space-3);
		background: var(--bg-sidebar);
		border-right: 1px solid var(--border-subtle);
		transition: width var(--transition);

		&.collapsed {
			width: 64px;
		}
	}

	.brand {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-2) var(--space-5);
	}

	.wordmark {
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		letter-spacing: -0.02em;
		color: var(--accent-text);

		.dim {
			color: var(--text-muted);
			font-weight: var(--weight-medium);
			margin-left: 3px;
		}
	}

	.collapse {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition:
			background var(--transition),
			color var(--transition);

		&:hover {
			background: var(--bg-column);
			color: var(--text-secondary);
		}
	}

	nav {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.group + .group {
		margin-top: var(--space-5);
	}

	.group-label {
		padding: 0 var(--space-2) var(--space-2);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-lg);
		color: var(--text-secondary);
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		transition:
			background var(--transition),
			color var(--transition);

		&:hover {
			background: var(--bg-column);
			color: var(--text-primary);
		}

		/* The active state is the one place the green really shows in the nav. */
		&.active {
			background: var(--accent-soft);
			color: var(--text-primary);
			font-weight: var(--weight-semi);

			:global(svg) {
				color: var(--accent-text);
			}
		}
	}

	li + li {
		margin-top: 2px;
	}

	.label {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		flex: none;
		padding: 1px var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--bg-column);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		color: var(--text-secondary);
	}

	.nav-item.active .count {
		background: #ffffff;
		color: var(--accent-text);
	}

	.foot {
		padding-top: var(--space-4);
		border-top: 1px solid var(--border-subtle);
	}

	/* Labels are always in the DOM and hidden with CSS, so the rail can be driven
	   either by the toggle or by a media query without duplicating the markup. */
	.collapsed {
		.label,
		.count,
		.group-label,
		.wordmark {
			display: none;
		}

		.nav-item {
			justify-content: center;
			padding: var(--space-2);
		}

		.brand {
			justify-content: center;
		}
	}

	/* Below this the sidebar is always a rail — 240px of nav is too much of a
	   phone screen to give up, and the toggle isn't worth the tap target. */
	@media (max-width: 900px) {
		.sidebar {
			width: 60px;
			padding: var(--space-3) var(--space-2);
		}

		.label,
		.count,
		.group-label,
		.wordmark {
			display: none;
		}

		.nav-item {
			justify-content: center;
			padding: var(--space-3) var(--space-2);
		}

		.brand {
			justify-content: center;
			padding: var(--space-1) 0 var(--space-4);
		}

		.collapse {
			display: none;
		}

		.group + .group {
			margin-top: var(--space-4);
		}
	}
</style>
