<script>
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { ago, fullDate } from '$lib/format.js';

	let { data, form } = $props();

	let syncing = $state(false);

	// A scanner that hasn't reported in over a day is probably a dead cron —
	// this page doubles as its monitor (SPEC §3.1).
	const STALE_SYNC_HOURS = 26;

	function syncIsStale(iso) {
		if (!iso) return true;
		return Date.now() - new Date(iso).getTime() > STALE_SYNC_HOURS * 3_600_000;
	}
</script>

<PageHeader title="Sources">
	{#snippet actions()}
		<form
			method="POST"
			action="?/sync"
			use:enhance={() => {
				syncing = true;
				return async ({ update }) => {
					await update();
					syncing = false;
				};
			}}
		>
			<Button variant="primary" type="submit" icon="refresh" disabled={syncing}>
				{syncing ? 'Syncing…' : 'Sync now'}
			</Button>
		</form>
	{/snippet}
</PageHeader>

<div class="scroll">
	{#if form?.synced}
		<p class="flash">
			Pulled {form.inserted} new {form.inserted === 1 ? 'candidate' : 'candidates'} from the scanner.
			{#if form.considered > form.inserted}
				{form.considered - form.inserted} already present.
			{/if}
		</p>
	{:else if form?.message}
		<p class="flash error">{form.message}</p>
	{/if}

	<div class="grid">
		{#each data.sources as source}
			<article class="source">
				<header>
					<div class="titles">
						<h2>{source.name}</h2>
						<p class="kind">{source.kind}</p>
					</div>
					<form method="POST" action="?/toggle" use:enhance>
						<input type="hidden" name="id" value={source.id} />
						<input type="hidden" name="enabled" value={String(!source.enabled)} />
						<button
							class="switch"
							class:on={source.enabled}
							type="submit"
							role="switch"
							aria-checked={source.enabled}
							aria-label="{source.enabled ? 'Disable' : 'Enable'} {source.name}"
						>
							<span class="knob"></span>
						</button>
					</form>
				</header>

				<dl class="counts">
					<div class="count new">
						<dt>New</dt>
						<dd>{source.counts.new}</dd>
					</div>
					<div class="count">
						<dt>Accepted</dt>
						<dd>{source.counts.accepted}</dd>
					</div>
					<div class="count">
						<dt>Rejected</dt>
						<dd>{source.counts.rejected}</dd>
					</div>
				</dl>

				<div class="health">
					<p>
						<span class="dim">Last ingest</span>
						{#if source.lastSyncedAt}
							<span title={fullDate(source.lastSyncedAt)}>{ago(source.lastSyncedAt)}</span>
						{:else}
							<span class="dim">never</span>
						{/if}
					</p>
					{#each source.scanner as state}
						<p class:warn={syncIsStale(state.lastSyncedAt)}>
							<span class="dim">Scanner · {state.source}</span>
							{#if state.lastSyncedAt}
								<span title={fullDate(state.lastSyncedAt)}>{ago(state.lastSyncedAt)}</span>
							{:else}
								<span>never</span>
							{/if}
							{#if syncIsStale(state.lastSyncedAt)}
								<Icon name="warn" size={13} />
							{/if}
						</p>
					{/each}
				</div>

				<footer>
					<Button href="/sources/{source.id}" variant="secondary" icon="arrowRight">
						Triage {source.counts.new}
					</Button>
					<span class="total">{source.counts.total} total</span>
				</footer>
			</article>
		{/each}
	</div>
</div>

<style lang="less">
	.scroll {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-5) var(--space-6) var(--space-6);
	}

	.flash {
		margin-bottom: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--accent-soft);
		color: var(--accent-text);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);

		&.error {
			background: var(--reject-soft);
			color: #991b1b;
		}
	}

	.grid {
		display: grid;
		/* 260px rather than 300px so a single card still fits a 320px phone once
		   the rail and padding are taken out. */
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: var(--space-4);
	}

	@media (max-width: 720px) {
		.scroll {
			padding: var(--space-4);
		}

		.grid {
			grid-template-columns: 1fr;
		}
	}

	.source {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--bg-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.titles {
		flex: 1;
		min-width: 0;
	}

	h2 {
		font-size: var(--text-lg);
		font-weight: var(--weight-semi);
	}

	.kind {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.switch {
		flex: none;
		width: 38px;
		height: 22px;
		padding: 2px;
		border-radius: var(--radius-pill);
		background: #dcdcd8;
		transition: background var(--transition);

		.knob {
			display: block;
			width: 18px;
			height: 18px;
			border-radius: var(--radius-pill);
			background: #ffffff;
			box-shadow: var(--shadow-card);
			transition: transform var(--transition);
		}

		&.on {
			background: var(--accent);

			.knob {
				transform: translateX(16px);
			}
		}
	}

	.counts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
		margin: 0;
	}

	.count {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--bg-column);

		dt {
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-secondary);
		}

		dd {
			margin: 0;
			font-size: var(--text-2xl);
			font-weight: var(--weight-bold);
			line-height: 1.2;
		}

		&.new {
			background: var(--accent-soft);

			dd {
				color: var(--accent-text);
			}
		}
	}

	.health {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--text-sm);
		color: var(--text-secondary);

		p {
			display: flex;
			align-items: center;
			gap: var(--space-2);
		}

		.dim {
			color: var(--text-muted);
		}

		.warn {
			color: var(--warn);

			.dim {
				color: var(--warn);
			}
		}
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: auto;
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle);
	}

	.total {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
