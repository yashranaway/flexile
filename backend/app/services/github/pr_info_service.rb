# frozen_string_literal: true

module Github
  class PrInfoService
    PR_URL_REGEX = %r{https://github\.com/(?<owner>[^/]+)/(?<repo>[^/]+)/pull/(?<number>\d+)}
    ISSUE_URL_REGEX = %r{https://github\.com/(?<owner>[^/]+)/(?<repo>[^/]+)/issues/(?<number>\d+)}
    BOUNTY_LABEL_REGEX = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/

    def initialize(user:)
      @user = user
    end

    def parse_pr_url(url)
      match = url.match(PR_URL_REGEX)
      return nil unless match

      {
        owner: match[:owner],
        repo: match[:repo],
        number: match[:number].to_i,
      }
    end

    def parse_issue_url(url)
      match = url.match(ISSUE_URL_REGEX)
      return nil unless match

      {
        owner: match[:owner],
        repo: match[:repo],
        number: match[:number].to_i,
      }
    end

    def fetch_pr_info(url)
      parsed = parse_pr_url(url)
      return nil unless parsed
      return nil unless @user.github_access_token.present?

      oauth_service = Github::OauthService.new
      pr_data = oauth_service.fetch_pull_request(
        access_token: @user.github_access_token,
        owner: parsed[:owner],
        repo: parsed[:repo],
        pr_number: parsed[:number]
      )

      return nil unless pr_data

      bounty = extract_bounty_from_labels(pr_data[:labels])

      {
        number: pr_data[:number],
        title: pr_data[:title],
        state: pr_data[:merged] ? "merged" : pr_data[:state],
        merged: pr_data[:merged],
        merged_at: pr_data[:merged_at],
        html_url: pr_data[:html_url],
        author_login: pr_data.dig(:user, :login),
        author_verified: pr_data.dig(:user, :login)&.downcase == @user.github_username&.downcase,
        repository: pr_data.dig(:head, :repo, :full_name),
        org: parsed[:owner],
        bounty_cents: bounty,
      }
    end

    def extract_bounty_from_labels(labels)
      return nil if labels.blank?

      labels.each do |label|
        match = label[:name].match(BOUNTY_LABEL_REGEX)
        if match
          amount_str = match[1].delete(",")
          return (amount_str.to_f * 100).to_i
        end
      end

      nil
    end

    def check_pr_paid_status(url, company:)
      invoice_line_items = InvoiceLineItem.joins(:invoice)
        .where(github_pr_url: url)
        .where(invoices: { company_id: company.id })
        .where(invoices: { status: Invoice::PAID_OR_PAYING_STATES })
        .where(invoices: { deleted_at: nil })

      return nil if invoice_line_items.empty?

      {
        paid: true,
        invoices: invoice_line_items.map do |item|
          {
            id: item.invoice.external_id,
            invoice_number: item.invoice.invoice_number,
            paid_at: item.invoice.paid_at,
            amount_cents: item.total_amount_cents,
          }
        end,
      }
    end

    def pr_belongs_to_company_org?(url, company:)
      return false unless company.github_integration&.active?

      parsed = parse_pr_url(url)
      return false unless parsed

      parsed[:owner].downcase == company.github_integration.organization_name.downcase
    end
  end
end
