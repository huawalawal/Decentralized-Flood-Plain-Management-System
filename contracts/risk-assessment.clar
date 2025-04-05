;; Risk Assessment Contract
;; Calculates vulnerability based on elevation and history

(define-map risk-assessments
  { property-id: uint }
  {
    risk-score: uint,
    flood-history-count: uint,
    last-assessment-date: uint,
    high-risk: bool
  }
)

;; Risk thresholds
(define-constant LOW-RISK-THRESHOLD u30)
(define-constant MEDIUM-RISK-THRESHOLD u70)
(define-constant HIGH-RISK-THRESHOLD u90)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-SCORE u101)

;; Contract owner
(define-constant contract-owner tx-sender)

;; Authorized assessors
(define-map authorized-assessors
  { assessor: principal }
  { authorized: bool }
)

;; Initialize contract owner as authorized assessor
(map-set authorized-assessors
  { assessor: contract-owner }
  { authorized: true }
)

;; Add an authorized assessor
(define-public (add-authorized-assessor (assessor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (map-set authorized-assessors
      { assessor: assessor }
      { authorized: true }
    )
    (ok true)
  )
)

;; Remove an authorized assessor
(define-public (remove-authorized-assessor (assessor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (map-set authorized-assessors
      { assessor: assessor }
      { authorized: false }
    )
    (ok true)
  )
)

;; Check if a principal is an authorized assessor
(define-read-only (is-authorized-assessor (assessor principal))
  (default-to false (get authorized (map-get? authorized-assessors { assessor: assessor })))
)

;; Calculate risk score based on elevation and flood history
(define-public (assess-risk
    (property-id uint)
    (elevation uint)
    (flood-history-count uint))
  (let
    (
      (caller tx-sender)
      (existing-assessment (map-get? risk-assessments { property-id: property-id }))
      (elevation-factor (if (< elevation u10) u50 (if (< elevation u30) u30 u10)))
      (history-factor (* flood-history-count u10))
      (risk-score (+ elevation-factor history-factor))
      (high-risk (> risk-score HIGH-RISK-THRESHOLD))
    )

    ;; Check if caller is authorized
    (asserts! (is-authorized-assessor caller) (err ERR-NOT-AUTHORIZED))

    ;; Ensure risk score is valid (0-100)
    (asserts! (<= risk-score u100) (err ERR-INVALID-SCORE))

    ;; Store risk assessment
    (map-set risk-assessments
      { property-id: property-id }
      {
        risk-score: risk-score,
        flood-history-count: flood-history-count,
        last-assessment-date: block-height,
        high-risk: high-risk
      }
    )

    (ok risk-score)
  )
)

;; Record a new flood event for a property
(define-public (record-flood-event (property-id uint))
  (let
    (
      (caller tx-sender)
      (existing-assessment (default-to
        { risk-score: u0, flood-history-count: u0, last-assessment-date: u0, high-risk: false }
        (map-get? risk-assessments { property-id: property-id })))
      (new-flood-count (+ (get flood-history-count existing-assessment) u1))
    )

    ;; Check if caller is authorized
    (asserts! (is-authorized-assessor caller) (err ERR-NOT-AUTHORIZED))

    ;; Update flood history count
    (map-set risk-assessments
      { property-id: property-id }
      (merge existing-assessment { flood-history-count: new-flood-count })
    )

    (ok new-flood-count)
  )
)

;; Get risk assessment for a property
(define-read-only (get-risk-assessment (property-id uint))
  (map-get? risk-assessments { property-id: property-id })
)

;; Check if a property is high risk
(define-read-only (is-high-risk (property-id uint))
  (default-to false (get high-risk (map-get? risk-assessments { property-id: property-id })))
)
