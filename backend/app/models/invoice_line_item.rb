# frozen_string_literal: true

class InvoiceLineItem < ApplicationRecord
  include Serializable

  GITHUB_PR_URL_REGEX = %r{\Ahttps://github\.com/[^/]+/[^/]+/pull/\d+\z}

  belongs_to :invoice

  validates :description, presence: true
  validates :pay_rate_in_subunits, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :quantity, presence: true, numericality: { greater_than_or_equal_to: 0.01 }
  validates :github_pr_url, format: { with: GITHUB_PR_URL_REGEX, allow_blank: true }

  def has_github_pr?
    github_pr_url.present?
  end

  def normalized_quantity
    quantity / (hourly? ? 60.0 : 1.0)
  end

  def total_amount_cents
    (pay_rate_in_subunits * normalized_quantity).ceil
  end

  def cash_amount_in_cents
    return total_amount_cents if invoice.equity_percentage.zero?

    equity_amount_in_cents = ((total_amount_cents * invoice.equity_percentage) / 100.to_d).round
    total_amount_cents - equity_amount_in_cents
  end

  def cash_amount_in_usd
    cash_amount_in_cents / 100.0
  end
end
