# frozen_string_literal: true

class Internal::PrInfosController < Internal::BaseController
  before_action :authenticate_user_json!

  def show
    pr_url = params[:pr_url]

    if pr_url.blank?
      render json: { error: "PR URL is required" }, status: :bad_request
      return
    end

    pr_info_service = Github::PrInfoService.new(user: Current.user)

    parsed = pr_info_service.parse_pr_url(pr_url)
    unless parsed
      render json: { error: "Invalid GitHub PR URL format" }, status: :unprocessable_entity
      return
    end

    response = {
      valid: true,
      owner: parsed[:owner],
      repo: parsed[:repo],
      number: parsed[:number],
      requires_github_connection: false,
      already_paid: nil,
      pr_info: nil,
    }

    company = Current.company
    if company && pr_info_service.pr_belongs_to_company_org?(pr_url, company: company)
      unless Current.user.github_connected?
        response[:requires_github_connection] = true
      end
    end

    paid_status = pr_info_service.check_pr_paid_status(pr_url, company: company) if company
    response[:already_paid] = paid_status if paid_status

    if Current.user.github_connected?
      pr_info = pr_info_service.fetch_pr_info(pr_url)
      response[:pr_info] = pr_info if pr_info
    end

    render json: response
  end
end
