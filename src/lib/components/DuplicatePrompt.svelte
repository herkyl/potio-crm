<script>
	// SPEC §4.2 case 2: a candidate with no LinkedIn slug whose name exactly
	// matches someone already in `people`. Names are not identities, so this
	// never resolves itself — it asks.

	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let { duplicate } = $props();

	let dismissed = $state(false);
</script>

{#if !dismissed}
	<div class="prompt" role="alert">
		<div class="lead">
			<Icon name="warn" size={18} />
			<div>
				<p class="title">Possible duplicate</p>
				<p class="detail">
					<strong>{duplicate.proposed.full_name}</strong> has no LinkedIn URL, and that name is already
					in the database. Attach to the existing person, or create a separate one?
				</p>
			</div>
			<button class="dismiss" onclick={() => (dismissed = true)} aria-label="Dismiss">
				<Icon name="x" size={16} />
			</button>
		</div>

		<ul class="matches">
			{#each duplicate.candidates as person}
				<li>
					<div class="who">
						<p class="name">{person.full_name}</p>
						<p class="meta">
							{person.headline || person.company || 'No headline'}
							{#if person.linkedin_url}· {person.linkedin_url}{/if}
						</p>
					</div>
					<form method="POST" action="?/accept" use:enhance>
						<input type="hidden" name="leadId" value={duplicate.leadId} />
						<input type="hidden" name="personId" value={person.id} />
						<Button size="sm" type="submit">Attach to this person</Button>
					</form>
				</li>
			{/each}
		</ul>

		<form method="POST" action="?/accept" use:enhance class="new">
			<input type="hidden" name="leadId" value={duplicate.leadId} />
			<input type="hidden" name="forceNew" value="true" />
			<Button size="sm" variant="primary" type="submit" icon="plus">
				Different person — create new
			</Button>
		</form>
	</div>
{/if}

<style lang="less">
	.prompt {
		flex: none;
		margin: var(--space-4) var(--space-6) 0;
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--warn-soft);
		border: 1px solid #f3e0ab;
	}

	.lead {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		color: #92400e;
	}

	.title {
		font-size: var(--text-base);
		font-weight: var(--weight-semi);
	}

	.detail {
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.dismiss {
		margin-left: auto;
		color: inherit;
		opacity: 0.6;

		&:hover {
			opacity: 1;
		}
	}

	.matches {
		margin: var(--space-3) 0;
		border-radius: var(--radius-md);
		background: #ffffff;
		overflow: hidden;

		li {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-3);
			border-bottom: 1px solid var(--border-subtle);

			&:last-child {
				border-bottom: none;
			}
		}
	}

	.who {
		flex: 1;
		min-width: 0;
	}

	.name {
		font-size: var(--text-base);
		font-weight: var(--weight-semi);
	}

	.meta {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.new {
		display: flex;
		justify-content: flex-end;
	}
</style>
