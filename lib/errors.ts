export class BudgetExceededError extends Error {
  constructor() {
    super('BUDGET_EXCEEDED')
    this.name = 'BudgetExceededError'
  }
}
