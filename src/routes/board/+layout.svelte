<script>
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { invalidateAll, goto } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ProspectCard from '$lib/components/ProspectCard.svelte';
	import ManualProspectModal from '$lib/components/ManualProspectModal.svelte';
	import { STAGES, STAGE_IDS, TERMINAL_STATUSES, isStale } from '$lib/stages.js';

	let { data, children } = $props();

	const FLIP_MS = 160;
	const TERMINAL_IDS = TERMINAL_STATUSES.map((t) => t.id);
	const ZONES = [...STAGE_IDS, ...TERMINAL_IDS];

	let search = $state('');
	let staleOnly = $state(false);
	let dueOnly = $state(false);
	let expanded = $state({ won: false, lost: false, parked: false });
	let addingManually = $state(false);
	let moveError = $state(null);

	/** Which column a prospect belongs in: its stage while open, its status once closed. */
	const zoneOf = (p) => (p.status === 'open' ? p.stage : p.status);

	function group(prospects) {
		const out = Object.fromEntries(ZONES.map((z) => [z, []]));
		for (const p of prospects) {
			const zone = zoneOf(p);
			if (out[zone]) out[zone].push(p);
		}
		return out;
	}

	const visible = $derived.by(() => {
		const needle = search.trim().toLowerCase();
		return data.prospects.filter((p) => {
			if (staleOnly && !(p.status === 'open' && isStale(p.stage, p.stage_entered_at))) return false;
			if (dueOnly && !(p.next_action_at && new Date(p.next_action_at) <= new Date())) return false;
			if (!needle) return true;
			return [p.full_name, p.headline, p.company, p.location]
				.filter(Boolean)
				.some((field) => field.toLowerCase().includes(needle));
		});
	});

	// dndzone mutates the arrays it's given, so columns are local state that
	// re-syncs whenever the server data or the filters change.
	let columns = $state(group([]));

	$effect(() => {
		columns = group(visible);
	});

	const openCount = $derived(data.prospects.filter((p) => p.status === 'open').length);
	const staleCount = (zone) =>
		columns[zone]?.filter((p) => p.status === 'open' && isStale(p.stage, p.stage_entered_at))
			.length ?? 0;

	function onconsider(zone, event) {
		columns[zone] = event.detail.items;
	}

	async function onfinalize(zone, event) {
		columns[zone] = event.detail.items;

		// Anything now sitting in a column it didn't belong to has been moved.
		const moved = event.detail.items.filter((p) => zoneOf(p) !== zone);
		if (moved.length === 0) return;

		const isTerminal = TERMINAL_IDS.includes(zone);

		for (const prospect of moved) {
			// Optimistic, so the card doesn't snap back while the request is in flight.
			if (isTerminal) prospect.status = zone;
			else {
				prospect.stage = zone;
				prospect.status = 'open';
			}

			try {
				const response = await fetch('/board/move', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(
						isTerminal
							? { prospectId: prospect.id, status: zone }
							: { prospectId: prospect.id, stage: zone }
					)
				});
				if (!response.ok) throw new Error((await response.json()).message ?? response.statusText);
			} catch (err) {
				moveError = `Couldn't move ${prospect.full_name}: ${err.message}`;
			}
		}

		await invalidateAll();
	}
</script>

<PageHeader title="Board">
	{#snippet actions()}
		<Button icon="sources" href="/sources">Triage</Button>
		<Button variant="primary" icon="plus" onclick={() => (addingManually = true)}>
			Add prospect
		</Button>
	{/snippet}

	{#snippet subnav()}
		<nav class="views">
			<a class="view active" href="/board"><Icon name="board" size={16} /> Board</a>
			<a class="view" href="/list"><Icon name="list" size={16} /> List</a>
		</nav>

		<!-- The worklist strip. The invite counter is derived from our own
		     invite_sent_at timestamps, never from LinkedIn (SPEC §3.6). -->
		<div class="stats">
			<span><strong>{openCount}</strong> open</span>
			<span class="sep">·</span>
			<span><strong>{data.stats.toInvite}</strong> to invite</span>
			<span class="sep">·</span>
			<span><strong>{data.stats.toMessage}</strong> awaiting message</span>
			<span class="sep">·</span>
			<span><strong>{data.stats.replies}</strong> in conversation</span>
			<span class="sep">·</span>
			<span class:due={data.stats.due > 0}><strong>{data.stats.due}</strong> due</span>
			<span class="sep">·</span>
			<span title="Rolling 7-day count from this database. Advisory only.">
				<strong>{data.stats.invites7d}</strong> invites this week
			</span>
		</div>

		<div class="filters">
			<label class="search">
				<Icon name="search" size={15} />
				<input type="search" placeholder="Search prospects…" bind:value={search} />
			</label>
			<button class="chip" class:on={staleOnly} onclick={() => (staleOnly = !staleOnly)}>
				<Icon name="warn" size={13} /> Stale
			</button>
			<button class="chip" class:on={dueOnly} onclick={() => (dueOnly = !dueOnly)}>
				<Icon name="clock" size={13} /> Due
			</button>
		</div>
	{/snippet}
</PageHeader>

{#if moveError}
	<p class="move-error">
		{moveError}
		<button onclick={() => (moveError = null)} aria-label="Dismiss"
			><Icon name="x" size={14} /></button
		>
	</p>
{/if}

<div class="board">
	<div class="stages">
		{#each STAGES as stage}
			<section class="column">
				<header class="column-header">
					<div class="column-titles">
						<p class="stage-name" title={stage.hint}>{stage.label}</p>
						<p class="stage-count">
							{columns[stage.id].length}
							{#if staleCount(stage.id) > 0}
								<span class="stale-count" title="{staleCount(stage.id)} stale">
									{staleCount(stage.id)} stale
								</span>
							{/if}
						</p>
					</div>
					<button class="column-menu" aria-label="{stage.label} options" title={stage.hint}>
						<Icon name="dots" size={16} />
					</button>
				</header>

				<div
					class="cards"
					use:dndzone={{ items: columns[stage.id], flipDurationMs: FLIP_MS, type: 'prospect' }}
					onconsider={(e) => onconsider(stage.id, e)}
					onfinalize={(e) => onfinalize(stage.id, e)}
				>
					{#each columns[stage.id] as prospect (prospect.id)}
						<div animate:flip={{ duration: FLIP_MS }}>
							<ProspectCard {prospect} onopen={(id) => goto(`/board/${id}`)} />
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>

	<!-- Won / Lost / Parked pinned right, collapsed and tinted so the ends of the
	     board read differently from the working stages (SPEC §3.3, §6.3). -->
	<div class="terminals">
		{#each TERMINAL_STATUSES as terminal}
			<section class="column terminal {terminal.id}" class:expanded={expanded[terminal.id]}>
				<header class="column-header">
					<button
						class="terminal-toggle"
						onclick={() => (expanded[terminal.id] = !expanded[terminal.id])}
						aria-expanded={expanded[terminal.id]}
					>
						<Icon name={terminal.icon} size={15} />
						{#if expanded[terminal.id]}
							<div class="column-titles">
								<p class="stage-name">{terminal.label}</p>
								<p class="stage-count">{columns[terminal.id].length}</p>
							</div>
						{:else}
							<span class="vertical">{terminal.label}</span>
							<span class="pill">{columns[terminal.id].length}</span>
						{/if}
					</button>
				</header>

				<div
					class="cards"
					use:dndzone={{ items: columns[terminal.id], flipDurationMs: FLIP_MS, type: 'prospect' }}
					onconsider={(e) => onconsider(terminal.id, e)}
					onfinalize={(e) => onfinalize(terminal.id, e)}
				>
					{#each columns[terminal.id] as prospect (prospect.id)}
						<div animate:flip={{ duration: FLIP_MS }}>
							{#if expanded[terminal.id]}
								<ProspectCard {prospect} onopen={(id) => goto(`/board/${id}`)} />
							{:else}
								<div class="mini" title={prospect.full_name}>{prospect.full_name}</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if addingManually}
	<ManualProspectModal onclose={() => (addingManually = false)} />
{/if}

{@render children()}

<style lang="less">
	.views {
		display: flex;
		gap: var(--space-4);
	}

	.view {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-1);
		border-bottom: 2px solid transparent;
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);

		&:hover {
			color: var(--text-primary);
		}

		&.active {
			color: var(--text-primary);
			font-weight: var(--weight-semi);
			border-bottom-color: var(--accent);

			:global(svg) {
				color: var(--accent-text);
			}
		}
	}

	.stats {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		overflow-x: auto;
		font-size: var(--text-sm);
		color: var(--text-secondary);

		span {
			white-space: nowrap;
		}

		strong {
			color: var(--text-primary);
			font-weight: var(--weight-semi);
		}

		.sep {
			color: var(--border-input);
		}

		.due strong {
			color: var(--warn);
		}
	}

	.filters {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		height: 32px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		color: var(--text-muted);

		&:focus-within {
			border-color: var(--accent);
		}

		input {
			width: 160px;
			border: none;
			outline: none;
			background: none;
			font-size: var(--text-sm);
			color: var(--text-primary);
		}
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
		transition:
			background var(--transition),
			color var(--transition),
			border-color var(--transition);

		&:hover {
			background: var(--bg-hover);
		}

		&.on {
			background: var(--accent-soft);
			border-color: var(--accent-soft);
			color: var(--accent-text);
		}
	}

	.move-error {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: none;
		margin: var(--space-3) var(--space-6) 0;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--reject-soft);
		color: #991b1b;
		font-size: var(--text-sm);

		button {
			margin-left: auto;
			color: inherit;
		}
	}

	/* The board area is white; columns are the faint warm gray. SPEC §6.3. */
	.board {
		flex: 1;
		display: flex;
		gap: var(--space-3);
		min-height: 0;
		padding: var(--space-5) var(--space-6);
		background: var(--bg-app);
	}

	/* Only the working stages scroll. Keeping the terminal columns outside this
	   container is what pins them right without `position: sticky` letting the
	   stage columns slide underneath. */
	.stages {
		flex: 1;
		display: flex;
		gap: var(--space-4);
		min-width: 0;
		min-height: 0;
		overflow-x: auto;
		padding-bottom: var(--space-1);
	}

	.column {
		display: flex;
		flex-direction: column;
		/* Fixed width rather than flexible: six stages plus three terminals only
		   read as a pipeline if the columns stay a predictable size. */
		flex: 0 0 236px;
		width: 236px;
		min-width: 0;
		min-height: 0;
		padding: var(--space-3);
		border-radius: var(--radius-lg);
		background: var(--bg-column);
	}

	.column-header {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		flex: none;
		padding: var(--space-1) var(--space-2) var(--space-3);
	}

	.column-titles {
		flex: 1;
		min-width: 0;
	}

	.stage-name {
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stage-count {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		line-height: 1.2;
	}

	.stale-count {
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--warn);
	}

	.column-menu {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);

		&:hover {
			background: #ffffff;
			color: var(--text-primary);
		}
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		flex: 1;
		min-height: 60px;
		overflow-y: auto;
		padding: 2px;
	}

	.terminals {
		display: flex;
		gap: var(--space-2);
		flex: none;
		min-height: 0;
	}

	.terminal {
		flex: 0 0 52px;
		max-width: 52px;
		padding: var(--space-2);
		transition:
			flex-basis var(--transition),
			max-width var(--transition);

		&.expanded {
			flex: 0 0 244px;
			max-width: 244px;
			padding: var(--space-3);
		}

		&.won {
			background: var(--bg-column-won);
		}

		&.lost {
			background: var(--bg-column-lost);
		}

		&.parked {
			background: var(--bg-column-parked);
		}
	}

	.terminal-toggle {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		color: var(--text-secondary);

		&:hover {
			color: var(--text-primary);
		}
	}

	.terminal.expanded .terminal-toggle {
		flex-direction: row;
		align-items: flex-start;
		text-align: left;
	}

	.vertical {
		writing-mode: vertical-rl;
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.pill {
		padding: 1px var(--space-2);
		border-radius: var(--radius-pill);
		background: #ffffff;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
	}

	.mini {
		padding: var(--space-2) var(--space-1);
		border-radius: var(--radius-sm);
		background: #ffffff;
		box-shadow: var(--shadow-card);
		font-size: 10px;
		text-align: center;
		writing-mode: vertical-rl;
		max-height: 120px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* svelte-dnd-action marks the item being dragged; give it the lifted look. */
	:global(.cards [data-is-dnd-shadow-item-hint]),
	:global(.cards .dnd-item-dragged) {
		box-shadow: var(--shadow-drag);
	}
</style>
