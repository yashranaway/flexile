# frozen_string_literal: true

class GithubIntegration < ApplicationRecord
  include Deletable

  ACTIVE = "active"
  INACTIVE = "inactive"

  belongs_to :company

  encrypts :access_token
  encrypts :refresh_token

  validates :organization_name, presence: true
  validates :organization_id, presence: true
  validates :status, presence: true, inclusion: { in: [ACTIVE, INACTIVE] }

  scope :active, -> { alive.where(status: ACTIVE) }

  def active?
    status == ACTIVE && alive?
  end

  def disconnect!
    mark_deleted!
  end
end
