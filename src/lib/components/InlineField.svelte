<script>
	// Click to edit, save on blur or Enter, Escape to abandon. Used for every
	// person field in the card modal (SPEC §3.4 — "inline edit on click, save on
	// blur or explicit save").

	import Icon from './Icon.svelte';

	let {
		label,
		value = '',
		name,
		placeholder = '—',
		multiline = false,
		hint = null,
		onsave
	} = $props();

	const AUTOSAVE_MS = 400;

	let editing = $state(false);
	let draft = $state('');
	let input = $state(null);

	let timer = null;
	// The last value actually sent, so a pause-then-blur doesn't send twice.
	let lastSent = null;

	function start() {
		draft = value ?? '';
		lastSent = value ?? '';
		editing = true;
	}

	function send() {
		const next = draft ?? '';
		if (next === lastSent) return;
		lastSent = next;
		onsave?.(name, next);
	}

	/** Autosave on a pause in typing, so a long edit isn't lost if the tab dies. */
	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(send, AUTOSAVE_MS);
	}

	function commit() {
		clearTimeout(timer);
		editing = false;
		send();
	}

	function abandon() {
		clearTimeout(timer);
		editing = false;
		// Anything already autosaved stays saved; only the un-sent tail is dropped.
		draft = lastSent ?? value ?? '';
	}

	function onkeydown(event) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			abandon();
		} else if (event.key === 'Enter' && !multiline) {
			event.preventDefault();
			commit();
		}
	}

	$effect(() => {
		if (editing) input?.focus();
	});

	$effect(() => () => clearTimeout(timer));
</script>

<div class="field">
	<span class="label">{label}</span>

	{#if editing}
		{#if multiline}
			<textarea
				bind:this={input}
				bind:value={draft}
				rows="3"
				{oninput}
				onblur={commit}
				{onkeydown}
				aria-label={label}
			></textarea>
		{:else}
			<input
				bind:this={input}
				bind:value={draft}
				{oninput}
				onblur={commit}
				{onkeydown}
				aria-label={label}
			/>
		{/if}
		{#if hint}<small class="hint">{@render hint(draft)}</small>{/if}
	{:else}
		<button class="value" class:empty={!value} onclick={start}>
			<span>{value || placeholder}</span>
			<Icon name="edit" size={13} />
		</button>
	{/if}
</div>

<style lang="less">
	.field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.label {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.value {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-1) var(--space-2);
		margin-left: calc(var(--space-2) * -1);
		border-radius: var(--radius-sm);
		text-align: left;
		font-size: var(--text-base);
		transition: background var(--transition);

		span {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		/* The pencil only appears on hover, so the panel stays calm at rest. */
		:global(svg) {
			opacity: 0;
			color: var(--text-muted);
			transition: opacity var(--transition);
		}

		&:hover {
			background: var(--bg-column);

			:global(svg) {
				opacity: 1;
			}
		}

		&.empty span {
			color: var(--text-muted);
		}
	}

	input,
	textarea {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		background: #ffffff;
		font-size: var(--text-base);
		resize: vertical;

		&:focus {
			outline: none;
		}
	}

	.hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
