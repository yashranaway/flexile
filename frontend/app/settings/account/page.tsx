"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/global";
import { request } from "@/utils/request";

const githubConnectionSchema = z.object({
  connected: z.boolean(),
  username: z.string().nullable().optional(),
  uid: z.string().nullable().optional(),
});

const GITHUB_CONNECT_PATH = "/internal/settings/github/connect";
const GITHUB_STATUS_PATH = "/internal/settings/github";

export default function AccountPage() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  const { data: githubConnection, isLoading } = useQuery({
    queryKey: ["githubConnection"],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: GITHUB_STATUS_PATH,
        accept: "json",
      });
      if (!response.ok) throw new Error("Failed to fetch GitHub connection");
      return githubConnectionSchema.parse(await response.json());
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "POST",
        url: GITHUB_CONNECT_PATH,
        accept: "json",
      });
      if (!response.ok) throw new Error("Failed to start GitHub connection");
      const data = z.object({ authorization_url: z.string() }).parse(await response.json());

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.authorization_url,
        "github-oauth",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      return new Promise<void>((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            void queryClient.invalidateQueries({ queryKey: ["githubConnection"] });
            resolve();
          }
        }, 500);

        setTimeout(() => {
          clearInterval(checkClosed);
          reject(new Error("Connection timed out"));
        }, 120000);
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "DELETE",
        url: GITHUB_STATUS_PATH,
        accept: "json",
      });
      if (!response.ok) throw new Error("Failed to disconnect GitHub");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["githubConnection"] });
      setDisconnectModalOpen(false);
    },
  });

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground mt-1">Manage your linked accounts and workspace access.</p>
      </div>

      {/* Integrations Section */}
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Integrations</h2>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium">GitHub</div>
              <div className="text-muted-foreground text-sm">
                Your account is linked for verifying pull requests and bounties.
              </div>
            </div>
            <div>
              {isLoading ? (
                <Button variant="outline" disabled>
                  Loading...
                </Button>
              ) : githubConnection?.connected ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {githubConnection.username}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDisconnectModalOpen(true)} className="cursor-pointer">
                      Disconnect account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                  {connectMutation.isPending ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workspace Access Section */}
      {user.roles.worker ? (
        <div className="grid gap-4">
          <h2 className="text-lg font-semibold">Workspace access</h2>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-green-100">
                <svg className="h-5 w-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div className="flex-1 font-medium">Acme</div>
              <Button variant="outline">Leave workspace</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Disconnect Confirmation Modal */}
      <Dialog open={disconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Github account?</DialogTitle>
            <DialogDescription>Disconnecting stops us from verifying your GitHub work.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDisconnectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
