export class BudgetExceededError extends Error {
  constructor() {
    super('BUDGET_EXCEEDED')
    this.name = 'BudgetExceededError'
  }
}

export class GenerationFailedError extends Error {
  constructor(reason: string) {
    super(`GENERATION_FAILED: ${reason}`)
    this.name = 'GenerationFailedError'
  }
}
