<script lang="ts" module>
	export const titles: { [key: string]: string } = {
		today: "Today",
		week: "This week",
		month: "This month",
		older: "Older",
	} as const;
</script>

<script lang="ts">
	import { base } from "$app/paths";

	import IconSun from "$lib/components/icons/IconSun.svelte";
	import IconMoon from "$lib/components/icons/IconMoon.svelte";
	import { switchTheme, subscribeToTheme } from "$lib/switchTheme";
	import { isAborted } from "$lib/stores/isAborted";
	import { onDestroy } from "svelte";

	import NavConversationItem from "./NavConversationItem.svelte";
	import type { LayoutData } from "../../routes/$types";
	import type { ConvSidebar } from "$lib/types/ConvSidebar";
	import type { Model } from "$lib/types/Model";
	import { page } from "$app/state";
	import InfiniteScroll from "./InfiniteScroll.svelte";
	import { CONV_NUM_PER_PAGE } from "$lib/constants/pagination";
	import { browser } from "$app/environment";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	import { useAPIClient, handleResponse } from "$lib/APIClient";
	import { requireAuthUser } from "$lib/utils/auth";
	import { enabledServersCount } from "$lib/stores/mcpServers";
	import { isPro } from "$lib/stores/isPro";
	import IconPro from "$lib/components/icons/IconPro.svelte";
	import MCPServerManager from "./mcp/MCPServerManager.svelte";

	const publicConfig = usePublicConfig();
	const client = useAPIClient();

	interface Props {
		conversations: ConvSidebar[];
		user: LayoutData["user"];
		p?: number;
		ondeleteConversation?: (id: string) => void;
		oneditConversationTitle?: (payload: { id: string; title: string }) => void;
	}

	let {
		conversations = $bindable(),
		user,
		p = $bindable(0),
		ondeleteConversation,
		oneditConversationTitle,
	}: Props = $props();

	let hasMore = $state(true);

	function handleNewChatClick(e: MouseEvent) {
		isAborted.set(true);

		if (requireAuthUser()) {
			e.preventDefault();
		}
	}

	function handleNavItemClick(e: MouseEvent) {
		if (requireAuthUser()) {
			e.preventDefault();
		}
	}

	const dateRanges = [
		new Date().setDate(new Date().getDate() - 1),
		new Date().setDate(new Date().getDate() - 7),
		new Date().setMonth(new Date().getMonth() - 1),
	];

	let groupedConversations = $derived({
		today: conversations.filter(({ updatedAt }) => updatedAt.getTime() > dateRanges[0]),
		week: conversations.filter(
			({ updatedAt }) => updatedAt.getTime() > dateRanges[1] && updatedAt.getTime() < dateRanges[0]
		),
		month: conversations.filter(
			({ updatedAt }) => updatedAt.getTime() > dateRanges[2] && updatedAt.getTime() < dateRanges[1]
		),
		older: conversations.filter(({ updatedAt }) => updatedAt.getTime() < dateRanges[2]),
	});

	const nModels: number = page.data.models.filter((el: Model) => !el.unlisted).length;

	async function handleVisible() {
		p++;
		const newConvs = await client.conversations
			.get({
				query: {
					p,
				},
			})
			.then(handleResponse)
			.then((r) => r.conversations)
			.catch((): ConvSidebar[] => []);

		if (newConvs.length === 0) {
			hasMore = false;
		}

		conversations = [...conversations, ...newConvs];
	}

	$effect(() => {
		if (conversations.length <= CONV_NUM_PER_PAGE) {
			// reset p to 0 if there's only one page of content
			// that would be caused by a data loading invalidation
			p = 0;
		}
	});

	let isDark = $state(false);
	let unsubscribeTheme: (() => void) | undefined;
	let showMcpModal = $state(false);

	if (browser) {
		unsubscribeTheme = subscribeToTheme(({ isDark: nextIsDark }) => {
			isDark = nextIsDark;
		});
	}

	onDestroy(() => {
		unsubscribeTheme?.();
	});
</script>

<div class="flex flex-col">
	<!-- Logo + App Title -->
	<div class="flex items-center gap-1 px-1.5 py-1">
		<a
			class="flex size-10 select-none items-center justify-center rounded-full transition-colors hover:bg-gemini-hoverBg"
			href="{publicConfig.PUBLIC_ORIGIN}{base}/"
			title="Home"
		>
			<img src="/sparkle.svg" alt="Gemini" class="size-8" />
		</a>
		<span class="truncate text-base font-medium text-gemini-onSurface">
			{publicConfig.PUBLIC_APP_NAME}
		</span>
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-col gap-0.5 px-2 pb-1 pt-1">
		<a
			href={`${base}/`}
			onclick={handleNewChatClick}
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gemini-onSurface transition-colors hover:bg-gemini-hoverBg"
			title="チャットを新規作成"
		>
			<svg
				width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg
			>
			<span class="truncate">チャットを新規作成</span>
		</a>
		<button
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gemini-onSurface transition-colors hover:bg-gemini-hoverBg"
			title="チャットを検索"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
			</svg>
			<span class="truncate">チャットを検索</span>
		</button>
	</div>
</div>

<div
	class="scrollbar-custom flex touch-pan-y flex-col gap-1 overflow-y-auto px-2 pb-3 pt-1 text-[.9rem] text-gemini-onSurfaceVariant"
>
	<div class="flex flex-col gap-px">
		{#each Object.entries(groupedConversations) as [group, convs]}
			{#if convs.length}
				<h4 class="mb-1 mt-3 pl-3 text-xs font-medium text-gemini-onSurfaceVariant/70 first:mt-0">
					{titles[group]}
				</h4>
				{#each convs as conv}
					<NavConversationItem {conv} {oneditConversationTitle} {ondeleteConversation} />
				{/each}
			{/if}
		{/each}
	</div>
	{#if hasMore}
		<InfiniteScroll onvisible={handleVisible} />
	{/if}
</div>
<div
	class="flex touch-none flex-col gap-px px-2 py-2 text-base text-gemini-onSurfaceVariant sm:text-sm"
>
	{#if user?.username || user?.email}
		<div
			class="group flex h-9 items-center gap-2 rounded-xl pl-3 pr-2 text-gemini-onSurfaceVariant transition-colors hover:bg-gemini-hoverBg max-sm:h-10"
		>
			<img
				src="https://huggingface.co/api/users/{user.username}/avatar?redirect=true"
				class="size-6 rounded-full border border-white/10"
				alt=""
			/>
			{#if publicConfig.isHuggingChat && user?.username}
				<a
					href="https://huggingface.co/{user.username}"
					target="_blank"
					rel="noopener noreferrer"
					class="flex flex-none shrink items-center gap-1.5 truncate pr-2 text-sm hover:underline"
					>{user.username}</a
				>
			{:else}
				<span class="flex flex-none shrink items-center gap-1.5 truncate pr-2 text-sm"
					>{user?.username || user?.email}</span
				>
			{/if}

			{#if publicConfig.isHuggingChat && $isPro === false}
				<a
					href="https://huggingface.co/subscribe/pro?from=HuggingChat"
					target="_blank"
					rel="noopener noreferrer"
					class="ml-auto flex h-[20px] items-center gap-1 px-1.5 py-0.5 text-xs text-gemini-onSurfaceVariant"
				>
					<IconPro />
					Get PRO
				</a>
			{:else if publicConfig.isHuggingChat && $isPro === true}
				<span
					class="ml-auto flex h-[20px] items-center gap-1 px-1.5 py-0.5 text-xs text-gemini-onSurfaceVariant"
				>
					<IconPro />
					PRO
				</span>
			{/if}
		</div>
	{/if}
	<a
		href="{base}/models"
		class="flex h-9 flex-none items-center gap-2 rounded-xl pl-3 pr-2 text-gemini-onSurfaceVariant transition-colors hover:bg-gemini-hoverBg max-sm:h-10"
		onclick={handleNavItemClick}
	>
		<span class="text-sm">Models</span>
		<span
			class="ml-auto rounded-full bg-gemini-outline/30 px-2 py-0.5 text-xs text-gemini-onSurfaceVariant/70"
			>{nModels}</span
		>
	</a>

	{#if user?.username || user?.email}
		<button
			onclick={() => (showMcpModal = true)}
			class="flex h-9 flex-none items-center gap-2 rounded-xl pl-3 pr-2 text-gemini-onSurfaceVariant transition-colors hover:bg-gemini-hoverBg max-sm:h-10"
		>
			<span class="text-sm">MCP Servers</span>
			{#if $enabledServersCount > 0}
				<span class="ml-auto rounded-full bg-blue-600/15 px-2 py-0.5 text-xs text-blue-400">
					{$enabledServersCount}
				</span>
			{/if}
		</button>
	{/if}

	<a
		href="{base}/settings/application"
		class="flex h-9 flex-none items-center gap-2 rounded-xl pl-3 pr-2 text-gemini-onSurfaceVariant transition-colors hover:bg-gemini-hoverBg max-sm:h-10"
		onclick={handleNavItemClick}
	>
		<span class="text-sm">Settings</span>
	</a>
	<button
		onclick={() => {
			switchTheme();
		}}
		aria-label="Toggle theme"
		class="flex h-9 flex-none items-center gap-2 rounded-xl pl-3 pr-2 text-gemini-onSurfaceVariant transition-colors hover:bg-gemini-hoverBg max-sm:h-10"
	>
		{#if browser}
			{#if isDark}
				<IconSun />
			{:else}
				<IconMoon />
			{/if}
		{/if}
	</button>
</div>

{#if showMcpModal}
	<MCPServerManager onclose={() => (showMcpModal = false)} />
{/if}
