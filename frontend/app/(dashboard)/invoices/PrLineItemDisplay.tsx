"use client";

import { useQuery } from "@tanstack/react-query";
import { GitPullRequest, XCircle } from "lucide-react";
import Image from "next/image";
import React from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import GithubPaidIcon from "@/images/github-paid.svg";
import GithubVerifiedIcon from "@/images/github-verified.svg";
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

interface PrLineItemDisplayProps {
  description: string;
  githubPrUrl?: string | null;
  invoiceStatus: string;
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

export function PrLineItemDisplay({ description, githubPrUrl, invoiceStatus }: PrLineItemDisplayProps) {
  const prUrl = githubPrUrl ?? description;
  const isPrUrl = PR_URL_REGEX.test(prUrl);
  const parsed = parsePrUrl(prUrl);
  const isPaidInvoice = invoiceStatus === "paid";

  const { data: prInfo, isLoading } = useQuery({
    queryKey: ["prInfo", prUrl],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: `/internal/pr_info?pr_url=${encodeURIComponent(prUrl)}`,
        accept: "json",
      });
      if (!response.ok) return null;
      return prInfoSchema.parse(await response.json());
    },
    enabled: isPrUrl,
    staleTime: 60000,
  });

  if (!isPrUrl || !parsed) {
    return <span>{description}</span>;
  }

  const prData = prInfo?.pr_info;
  const bountyText = prData?.bounty_cents ? formatBounty(prData.bounty_cents) : null;
  const alreadyPaid = prInfo?.already_paid;
  const hasWarnings = !isPaidInvoice && (alreadyPaid?.paid || (prData && !prData.author_verified));

  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-pointer items-center gap-2">
          <GitPullRequest className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="text-muted-foreground shrink-0">
            {parsed.owner}/{parsed.repo}
          </span>
          {prData?.title ? (
            <a
              href={prData.html_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate hover:underline"
            >
              {prData.title}
            </a>
          ) : null}
          <span className="text-muted-foreground shrink-0">#{parsed.number}</span>
          {bountyText ? <span className="shrink-0 font-medium text-green-600">{bountyText}</span> : null}
          {hasWarnings ? <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" /> : null}
        </span>
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
            href={prData?.html_url ?? prUrl}
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

          {!isPaidInvoice && alreadyPaid?.paid && alreadyPaid.invoices[0] ? (
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
