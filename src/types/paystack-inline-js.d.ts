declare module "@paystack/inline-js" {
  export interface PaystackTransaction {
    reference: string;
    status?: string;
    trans?: string;
    transaction?: string;
    message?: string;
    [key: string]: unknown;
  }

  export interface PaystackResumeCallbacks {
    onSuccess?: (transaction: PaystackTransaction) => void;
    onCancel?: () => void;
    onLoad?: (response: unknown) => void;
    onError?: (error: { message?: string; [key: string]: unknown }) => void;
  }

  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: PaystackResumeCallbacks): void;
    newTransaction(options: Record<string, unknown>): unknown;
    cancelTransaction?(): void;
  }
}
