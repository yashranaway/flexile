"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { SignInMethod } from "@/db/enums";
import googleLogoLight from "@/images/google-light.svg";
import logo from "@/public/logo-icon.svg";
import { request } from "@/utils/request";

const emailSchema = z.object({ email: z.string().email() });
const otpSchema = z.object({
  otp: z.string().length(6, "Please enter the 6-digit verification code"),
});

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  Callback: "Access denied or an unexpected error occurred.",
  AccessDenied: "You do not have permission to perform this action.",
  Verification: "Invalid or expired verification link.",
};

export function AuthPage({
  title,
  description,
  switcher,
  sendOtpUrl,
  sendOtpText,
  onVerifyOtp,
}: {
  title: string;
  description: string;
  switcher: React.ReactNode;
  sendOtpUrl: string;
  sendOtpText: string;
  onVerifyOtp?: (data: { email: string; otp: string }) => Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const sendOtp = useMutation({
    mutationFn: async (values: { email: string }) => {
      const response = await request({
        url: sendOtpUrl,
        method: "POST",
        accept: "json",
        jsonData: values,
      });

      if (!response.ok) {
        throw new Error(
          z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
            "Failed to send verification code",
        );
      }
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async (values: { otp: string }) => {
      const email = emailForm.getValues("email");
      await onVerifyOtp?.({ email, otp: values.otp });

      const result = await signIn("otp", { email, otp: values.otp, redirect: false });

      if (result?.error) throw new Error("Invalid verification code");

      const session = await getSession();
      if (!session?.user.email) throw new Error("Invalid verification code");

      const redirectUrl = searchParams.get("redirect_url");
      setRedirectInProgress(true);
      router.replace(
        // @ts-expect-error - Next currently does not allow checking this at runtime - the leading / ensures this is safe
        redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard",
      );
    },
  });
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
  });
  const submitEmailForm = emailForm.handleSubmit(async (values) => {
    try {
      await sendOtp.mutateAsync(values);
      localStorage.setItem("last_sign_in_method", SignInMethod.Email);
    } catch (error) {
      emailForm.setError("email", {
        message: error instanceof Error ? error.message : "Failed to send verification code",
      });
    }
  });

  const otpForm = useForm({
    resolver: zodResolver(otpSchema),
  });
  const submitOtpForm = otpForm.handleSubmit(async (values) => {
    try {
      await verifyOtp.mutateAsync(values);
    } catch (error) {
      otpForm.setError("otp", { message: error instanceof Error ? error.message : "Failed to verify OTP" });
    }
  });

  const providerSignIn = (provider: SignInMethod) => {
    localStorage.setItem("last_sign_in_method", provider);
    const redirectUrlParam = searchParams.get("redirect_url");
    const redirectUrl =
      redirectUrlParam && redirectUrlParam.startsWith("/") && !redirectUrlParam.startsWith("//")
        ? redirectUrlParam
        : "/dashboard";
    void signIn(provider, { callbackUrl: redirectUrl });
  };

  return (
    <div className="flex items-center justify-center">
      <Card className="w-full max-w-md border-0 bg-transparent">
        <CardHeader className="text-center">
          <div className="mb-8 flex justify-center">
            <Image src={logo} alt="Flexile" className="size-16 dark:invert" />
          </div>
          <CardTitle className="pb-1 text-xl font-medium">
            {sendOtp.isSuccess ? "Check your email for a code" : title}
          </CardTitle>
          <CardDescription>
            {sendOtp.isSuccess ? "We’ve sent a 6-digit code to your email." : description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sendOtp.isSuccess ? (
            <Form {...otpForm}>
              <form onSubmit={(e) => void submitOtpForm(e)} className="flex flex-col items-center space-y-4">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="justify-items-center">
                      <FormControl>
                        <InputOTP
                          {...field}
                          maxLength={6}
                          onChange={(value) => {
                            // Filter out non-numeric characters
                            const numericValue = value.replace(/[^0-9]/gu, "");
                            field.onChange(numericValue);
                            if (numericValue.length === 6) setTimeout(() => void submitOtpForm(), 100);
                          }}
                          aria-label="Verification code"
                          disabled={verifyOtp.isPending || redirectInProgress}
                          autoFocus
                          required
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      {/* Reserve space for error message to prevent layout shift */}
                      <div className="min-h-5 text-center text-sm">
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <div className="text-center">
                  {verifyOtp.isPending || redirectInProgress ? (
                    <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                      Verifying your code...
                    </div>
                  ) : (
                    <Button className="text-muted-foreground text-sm" variant="link" onClick={() => sendOtp.reset()}>
                      Back to email
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          ) : null}
          {!sendOtp.isSuccess ? (
            <Form {...emailForm}>
              <form onSubmit={(e) => void submitEmailForm(e)} className="space-y-4">
                <div className="mb-4 flex flex-col items-center">
                  {oauthError ? (
                    <p className="text-destructive mb-2">
                      {Object.prototype.hasOwnProperty.call(OAUTH_ERROR_MESSAGES, oauthError)
                        ? OAUTH_ERROR_MESSAGES[oauthError]
                        : oauthError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="primary"
                    className="font-base flex h-11 w-full items-center justify-center gap-2"
                    onClick={() => providerSignIn(SignInMethod.Google)}
                  >
                    <Image src={googleLogoLight} alt="Google" width={20} height={20} />
                    {sendOtpText} with Google
                  </Button>
                  <Button
                    type="button"
                    className="font-base mt-2 flex h-11 w-full items-center justify-center gap-2 bg-[#24292f] text-white hover:bg-[#24292f]/90"
                    onClick={() => providerSignIn(SignInMethod.GitHub)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    {sendOtpText} with Github
                  </Button>
                  <div className="my-3 flex w-full items-center gap-2">
                    <div className="bg-muted h-px flex-1" />
                    <span className="text-muted-foreground text-sm">or</span>
                    <div className="bg-muted h-px flex-1" />
                  </div>
                </div>
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your work email..."
                          className="dark:bg-input/30 bg-white"
                          style={{ height: "42px" }}
                          required
                          disabled={sendOtp.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <MutationStatusButton
                  mutation={sendOtp}
                  type="submit"
                  className="text-foreground border-input dark:border-border dark:bg-input/30 hover:bg-accent dark:hover:bg-muted hover:border-input dark:hover:border-border hover:text-foreground dark:hover:text-foreground h-11 w-full bg-white"
                  loadingText="Sending..."
                >
                  {sendOtpText}
                </MutationStatusButton>

                <div className="text-muted-foreground pt-6 text-center text-sm">{switcher}</div>
              </form>
            </Form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
