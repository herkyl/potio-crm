<script>
	// SPEC §3.4 — create a person from scratch, for someone who never came
	// through a source.

	import { enhance } from '$app/forms';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import { normaliseLinkedInSlug } from '$lib/linkedin.js';

	let { onclose } = $props();

	let linkedinValue = $state('');
	let error = $state(null);
	let saving = $state(false);

	const slugPreview = $derived(normaliseLinkedInSlug(linkedinValue));
</script>

<Modal
	{onclose}
	width={560}
	title="Add prospect"
	subtitle="Goes straight to Shortlist. No source attached."
>
	<form
		id="manual-prospect"
		method="POST"
		action="/board?/create"
		use:enhance={() => {
			saving = true;
			error = null;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'failure') {
					error = result.data?.message ?? 'Something went wrong';
					return;
				}
				await update();
				onclose?.();
			};
		}}
	>
		{#if error}<p class="error">{error}</p>{/if}

		<div class="fields">
			<label class="wide">
				<span>Full name <em>required</em></span>
				<!-- svelte-ignore a11y_autofocus -->
				<input name="full_name" required autofocus />
			</label>

			<label class="wide">
				<span>LinkedIn URL <em>dedupe key</em></span>
				<input
					name="linkedin_url"
					bind:value={linkedinValue}
					placeholder="https://www.linkedin.com/in/…"
				/>
				{#if linkedinValue && slugPreview}
					<small class="hint ok">Will save as <code>{slugPreview}</code></small>
				{:else if linkedinValue}
					<small class="hint bad">Not a recognisable profile URL</small>
				{/if}
			</label>

			<label class="wide">
				<span>Headline</span>
				<input name="headline" placeholder="Founder & CEO, Acme" />
			</label>

			<label><span>Company</span><input name="company" /></label>
			<label><span>Location</span><input name="location" /></label>
			<label class="wide"><span>Website</span><input name="website_url" /></label>
		</div>
	</form>

	{#snippet footer()}
		<Button onclick={() => onclose?.()}>Cancel</Button>
		<Button variant="primary" type="submit" form="manual-prospect" icon="plus" disabled={saving}>
			{saving ? 'Adding…' : 'Add to shortlist'}
		</Button>
	{/snippet}
</Modal>

<style lang="less">
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);

		&.wide {
			grid-column: 1 / -1;
		}

		> span {
			display: flex;
			align-items: baseline;
			gap: var(--space-2);
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--text-secondary);
		}

		em {
			font-style: normal;
			font-size: var(--text-xs);
			color: var(--text-muted);
		}
	}

	input {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-input);
		border-radius: var(--radius-md);
		background: #ffffff;
		font-size: var(--text-base);

		&:focus {
			outline: none;
			border-color: var(--accent);
		}
	}

	.hint {
		font-size: var(--text-xs);

		&.ok {
			color: var(--accent-text);
		}

		&.bad {
			color: var(--reject);
		}

		code {
			font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		}
	}

	.error {
		margin-bottom: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--reject-soft);
		color: #991b1b;
		font-size: var(--text-sm);
	}
</style>
