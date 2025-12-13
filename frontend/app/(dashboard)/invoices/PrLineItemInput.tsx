"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitPullRequest, Loader2, RefreshCw, XCircle } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import GithubPaidIcon from "@/images/github-paid.svg";
import GithubVerifiedIcon from "@/images/github-verified.svg";
import { cn } from "@/utils";
import { request } from "@/utils/request";

const PR_URL_REGEX = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/u;

const prInfoSchema = z.object({
  valid: z.boolean(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  number: z.number().optional(),
  requires_github_connection: z.boolean().optional(),
  already_paid: z
    .object({
      paid: z.boolean(),
      invoices: z.array(
        z.object({
          id: z.string(),
          invoice_number: z.string(),
          paid_at: z.string().nullable(),
          amount_cents: z.number(),
        }),
      ),
    })
    .nullable()
    .optional(),
  pr_info: z
    .object({
      number: z.number(),
      title: z.string(),
      state: z.string(),
      merged: z.boolean(),
      merged_at: z.string().nullable(),
      html_url: z.string(),
      author_login: z.string().nullable(),
      author_verified: z.boolean(),
      repository: z.string().nullable(),
      org: z.string().nullable(),
      bounty_cents: z.number().nullable(),
    })
    .nullable()
    .optional(),
});

interface PrLineItemInputProps {
  value: string;
  onChange: (value: string) => void;
  onGithubPrUrlChange?: (url: string | null) => void;
  onRequiresGithubConnection?: (requires: boolean, orgName?: string) => void;
  ariaInvalid?: boolean | undefined;
  githubConnected?: boolean;
}

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(PR_URL_REGEX);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

function formatBounty(cents: number): string {
  if (cents >= 100000) {
    return `$${(cents / 100000).toFixed(cents % 100000 === 0 ? 0 : 1)}K`;
  }
  return `$${(cents / 100).toLocaleString()}`;
}

export function PrLineItemInput({
  value,
  onChange,
  onGithubPrUrlChange,
  onRequiresGithubConnection,
  ariaInvalid,
  githubConnected,
}: PrLineItemInputProps) {
  const [isEditing, setIsEditing] = useState(true);
  const [localValue, setLocalValue] = useState(value);
  const [showLoader, setShowLoader] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const isPrUrl = PR_URL_REGEX.test(value);
  const parsed = parsePrUrl(value);

  const {
    data: prInfo,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["prInfo", value],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: `/internal/pr_info?pr_url=${encodeURIComponent(value)}`,
        accept: "json",
      });
      if (!response.ok) throw new Error("Failed to fetch PR info");
      return prInfoSchema.parse(await response.json());
    },
    enabled: isPrUrl && !isEditing,
    staleTime: 60000,
    retry: false,
  });

  useEffect(() => {
    if (isFetching) {
      const timer = setTimeout(() => setShowLoader(true), 300);
      return () => clearTimeout(timer);
    }
    setShowLoader(false);
  }, [isFetching]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isPrUrl && prInfo) {
      onGithubPrUrlChange?.(value);
    } else {
      onGithubPrUrlChange?.(null);
    }
  }, [isPrUrl, prInfo, value, onGithubPrUrlChange]);

  useEffect(() => {
    if (isPrUrl && prInfo?.requires_github_connection && !githubConnected) {
      onRequiresGithubConnection?.(true, parsed?.owner);
    } else {
      onRequiresGithubConnection?.(false);
    }
  }, [isPrUrl, prInfo, githubConnected, onRequiresGithubConnection, parsed?.owner]);

  useEffect(() => {
    if (githubConnected && isPrUrl && !isEditing) {
      void queryClient.invalidateQueries({ queryKey: ["prInfo", value] });
    }
  }, [githubConnected, isPrUrl, isEditing, value, queryClient]);

  const handleBlur = () => {
    onChange(localValue);
    if (PR_URL_REGEX.test(localValue)) {
      setIsEditing(false);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handlePrettifiedClick = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    void refetch();
  };

  if (isEditing || !isPrUrl || !parsed) {
    return (
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          value={localValue}
          placeholder="Description or GitHub PR link..."
          aria-invalid={ariaInvalid}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className="pr-16"
        />
        {isPrUrl && !isEditing && (showLoader || isError) ? (
          <div className="absolute right-2 flex items-center gap-1">
            {isError ? (
              <Button type="button" variant="ghost" size="small" onClick={handleRetry} className="h-7 gap-1 text-xs">
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            ) : showLoader ? (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const prData = prInfo?.pr_info;
  const bountyText = prData?.bounty_cents ? formatBounty(prData.bounty_cents) : null;
  const alreadyPaid = prInfo?.already_paid;
  const hasWarnings = alreadyPaid?.paid || (prData && !prData.author_verified);

  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handlePrettifiedClick}
          className={cn(
            "border-input bg-background ring-offset-background flex h-10 w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          <GitPullRequest className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="text-muted-foreground shrink-0">
            {parsed.owner}/{parsed.repo}
          </span>
          {prData?.title ? <span className="truncate">{prData.title}</span> : null}
          <span className="text-muted-foreground shrink-0">#{parsed.number}</span>
          {bountyText ? <span className="shrink-0 font-medium text-green-600">{bountyText}</span> : null}
          {hasWarnings ? <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-orange-500" /> : null}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[360px] p-4" align="start">
        <div className="space-y-3">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>
              {parsed.owner}/{parsed.repo}
            </span>
            {prData?.author_login ? <span>{prData.author_login}</span> : null}
          </div>

          <a
            href={prData?.html_url ?? value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block hover:underline"
          >
            <h4 className="line-clamp-2 leading-tight font-semibold">
              {prData?.title ?? `Pull Request #${parsed.number}`}
              <span className="text-muted-foreground ml-1 font-normal">#{parsed.number}</span>
            </h4>
          </a>

          <div className="flex items-center gap-2">
            {prData?.state === "merged" || prData?.merged ? (
              <Badge className="bg-purple-600 hover:bg-purple-600">Merged</Badge>
            ) : prData?.state === "open" ? (
              <Badge className="bg-green-600 hover:bg-green-600">Open</Badge>
            ) : prData?.state === "closed" ? (
              <Badge variant="secondary">Closed</Badge>
            ) : isLoading ? (
              <Badge variant="outline">Loading...</Badge>
            ) : null}
          </div>

          {alreadyPaid?.paid && alreadyPaid.invoices[0] ? (
            <div className="flex items-center gap-2 text-sm">
              <Image src={GithubPaidIcon} alt="Paid" width={16} height={16} />
              <span className="text-green-600">Paid</span>
              <span className="text-muted-foreground">on invoice</span>
              <a
                href={`/invoices/${alreadyPaid.invoices[0].id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-foreground font-medium hover:underline"
              >
                #{alreadyPaid.invoices[0].invoice_number}
              </a>
            </div>
          ) : null}

          {prData ? (
            <div className="flex items-center gap-2 text-sm">
              {prData.author_verified ? (
                <>
                  <Image src={GithubVerifiedIcon} alt="Verified" width={16} height={16} />
                  <span className="text-green-600">Verified author of this pull request.</span>
                </>
              ) : (
                <>
                  <XCircle className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">Unverified author of this pull request.</span>
                </>
              )}
            </div>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
