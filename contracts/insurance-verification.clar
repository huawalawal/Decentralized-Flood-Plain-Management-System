;; Insurance Verification Contract
;; Validates appropriate coverage for properties

(define-map insurance-policies
  { property-id: uint }
  {
    policy-number: (string-utf8 50),
    provider: (string-utf8 100),
    coverage-amount: uint,
    expiration-date: uint,
    verified: bool,
    adequate-coverage: bool
  }
)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-POLICY-NOT-FOUND u101)
(define-constant ERR-EXPIRED-POLICY u102)

;; Contract owner
(define-constant contract-owner tx-sender)

;; Authorized insurance verifiers
(define-map authorized-verifiers
  { verifier: principal }
  { authorized: bool }
)

;; Initialize contract owner as authorized verifier
(map-set authorized-verifiers
  { verifier: contract-owner }
  { authorized: true }
)

;; Add an authorized verifier
(define-public (add-authorized-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (map-set authorized-verifiers
      { verifier: verifier }
      { authorized: true }
    )
    (ok true)
  )
)

;; Remove an authorized verifier
(define-public (remove-authorized-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (map-set authorized-verifiers
      { verifier: verifier }
      { authorized: false }
    )
    (ok true)
  )
)

;; Check if a principal is an authorized verifier
(define-read-only (is-authorized-verifier (verifier principal))
  (default-to false (get authorized (map-get? authorized-verifiers { verifier: verifier })))
)

;; Register an insurance policy
(define-public (register-insurance-policy
    (property-id uint)
    (policy-number (string-utf8 50))
    (provider (string-utf8 100))
    (coverage-amount uint)
    (expiration-date uint))
  (let
    (
      (caller tx-sender)
    )

    ;; Store policy data
    (map-set insurance-policies
      { property-id: property-id }
      {
        policy-number: policy-number,
        provider: provider,
        coverage-amount: coverage-amount,
        expiration-date: expiration-date,
        verified: false,
        adequate-coverage: false
      }
    )

    (ok true)
  )
)

;; Verify an insurance policy
(define-public (verify-insurance-policy
    (property-id uint)
    (risk-score uint)
    (property-value uint))
  (let
    (
      (caller tx-sender)
      (policy (unwrap! (map-get? insurance-policies { property-id: property-id }) (err ERR-POLICY-NOT-FOUND)))
      (current-block block-height)
      (required-coverage (calculate-required-coverage risk-score property-value))
      (has-adequate-coverage (>= (get coverage-amount policy) required-coverage))
    )

    ;; Check if caller is authorized
    (asserts! (is-authorized-verifier caller) (err ERR-NOT-AUTHORIZED))

    ;; Check if policy is expired
    (asserts! (< current-block (get expiration-date policy)) (err ERR-EXPIRED-POLICY))

    ;; Update policy verification status
    (map-set insurance-policies
      { property-id: property-id }
      (merge policy {
        verified: true,
        adequate-coverage: has-adequate-coverage
      })
    )

    (ok has-adequate-coverage)
  )
)

;; Calculate required coverage based on risk score and property value
(define-read-only (calculate-required-coverage (risk-score uint) (property-value uint))
  (let
    (
      (risk-factor (/ (* risk-score u100) u10000))
      (min-coverage (/ property-value u2))
    )
    (+ min-coverage (* property-value risk-factor))
  )
)

;; Get insurance policy for a property
(define-read-only (get-insurance-policy (property-id uint))
  (map-get? insurance-policies { property-id: property-id })
)

;; Check if a property has adequate insurance coverage
(define-read-only (has-adequate-coverage (property-id uint))
  (default-to false (get adequate-coverage (map-get? insurance-policies { property-id: property-id })))
)

;; Check if a property's insurance is verified
(define-read-only (is-insurance-verified (property-id uint))
  (default-to false (get verified (map-get? insurance-policies { property-id: property-id })))
)
