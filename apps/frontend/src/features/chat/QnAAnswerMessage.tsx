// Renders the "user answered" qna row — role: "user", type: "qna" — whose
// content is the raw `answers` array submitted to /qna-reply (see
// QnAMessage.tsx's UserAnswer/sendUserReply). A conversation can ask
// multiple questions in one qnaTool call, so this formats all of them as
// one question/answer list inside a single bubble instead of dumping the
// raw JSON array.
type QnAAnswer = {
  question: string;
  selectedOption: string;
};

export function isQnAAnswerList(content: unknown): content is QnAAnswer[] {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    content.every((item): item is QnAAnswer => {
      if (typeof item !== "object" || item === null) {
        return false;
      }

      const candidate = item as { question?: unknown; selectedOption?: unknown };
      return (
        typeof candidate.question === "string" &&
        typeof candidate.selectedOption === "string"
      );
    })
  );
}

export function QnAAnswerMessage({ answers }: { answers: QnAAnswer[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] space-y-2.5 rounded-lg bg-(--accent) px-4 py-3 text-sm leading-6 text-white">
        {answers.map((answer, index) => (
          <div
            className={index > 0 ? "border-t border-white/20 pt-2.5" : ""}
            key={`${answer.question}-${index}`}
          >
            <p className="font-medium">{answer.question}</p>
            <p className="mt-0.5 text-white/85">{answer.selectedOption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
