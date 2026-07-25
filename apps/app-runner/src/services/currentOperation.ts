type TCurrentOperaction = {
  type: "install" | "package";
  startedAt: string;
};
class CurrentOperation {
  private currentOperation: TCurrentOperaction | null = null;

  get() {
    return this.currentOperation;
  }

  set(updatedOperation: TCurrentOperaction | null) {
    this.currentOperation = updatedOperation;
  }
}
export const currentOperation = new CurrentOperation();
