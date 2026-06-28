import { useState } from "react";

type QnAQuestion = {
  inputType: "select";
  options: string[];
  question: string;
};

type QnAContent = {
  correlationId: string;
  questions: QnAQuestion[];
};

type UserAnswer = {
  question: string;
  selectedOption: string;
};

function getStoredAnswers(correlationId: string): UserAnswer[] | null {
  try {
    const storedValue = window.sessionStorage.getItem(
      `qna-answers:${correlationId}`,
    );

    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter((answer): answer is UserAnswer => {
      if (typeof answer !== "object" || answer === null) {
        return false;
      }

      const candidate = answer as {
        question?: unknown;
        selectedOption?: unknown;
      };

      return (
        typeof candidate.question === "string" &&
        typeof candidate.selectedOption === "string"
      );
    });
  } catch {
    return null;
  }
}

function storeAnswers(correlationId: string, answers: UserAnswer[]) {
  try {
    window.sessionStorage.setItem(
      `qna-answers:${correlationId}`,
      JSON.stringify(answers),
    );
  } catch {
    // Submitting answers is the source of truth; storage only prevents duplicate UI submits after a refetch.
  }
}

function parseQnAContent(content: unknown): QnAContent | null {
  if (typeof content !== "object" || content === null) {
    return null;
  }

  const candidate = content as {
    correlationId?: unknown;
    questions?: unknown;
  };

  if (
    typeof candidate.correlationId !== "string" ||
    !Array.isArray(candidate.questions)
  ) {
    return null;
  }

  const questions = candidate.questions.filter(
    (question): question is QnAQuestion => {
      if (typeof question !== "object" || question === null) {
        return false;
      }

      const candidateQuestion = question as {
        inputType?: unknown;
        options?: unknown;
        question?: unknown;
      };

      return (
        candidateQuestion.inputType === "select" &&
        typeof candidateQuestion.question === "string" &&
        candidateQuestion.question.length > 0 &&
        Array.isArray(candidateQuestion.options) &&
        candidateQuestion.options.every((option) => typeof option === "string")
      );
    },
  );

  if (questions.length !== candidate.questions.length) {
    return null;
  }

  return {
    correlationId: candidate.correlationId,
    questions,
  };
}

async function sendUserReply({
  answers,
  correlationId,
}: {
  answers: UserAnswer[];
  correlationId: string;
}) {
  const response = await fetch("/api/user-reply", {
    body: JSON.stringify({ answers, correlationId }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to send answers: ${response.status}`);
  }
}

export function QnAMessage({ content }: { content: unknown }) {
  const parsedContent = parseQnAContent(content);

  if (!parsedContent) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[82%] rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Invalid question format
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <QnACard content={parsedContent} />
    </div>
  );
}

function QnACard({ content }: { content: QnAContent }) {
  const storedAnswers = getStoredAnswers(content.correlationId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answersByQuestion, setAnswersByQuestion] = useState<
    Record<number, string>
  >(() => {
    if (!storedAnswers) {
      return {};
    }

    return Object.fromEntries(
      content.questions.flatMap((question, index) => {
        const answer = storedAnswers.find(
          (storedAnswer) => storedAnswer.question === question.question,
        );

        return answer ? [[index, answer.selectedOption]] : [];
      }),
    );
  });
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(() => storedAnswers !== null);

  const activeQuestion = content.questions[activeIndex];
  const selectedOption =
    activeIndex in answersByQuestion ? answersByQuestion[activeIndex] : "";
  const isLastQuestion = activeIndex === content.questions.length - 1;
  const answeredCount = Object.keys(answersByQuestion).length;
  const allQuestionsAnswered = answeredCount === content.questions.length;

  const handleSelectOption = (option: string) => {
    setAnswersByQuestion((current) => ({
      ...current,
      [activeIndex]: option,
    }));
    setSubmitError(null);

    if (!isLastQuestion) {
      window.setTimeout(() => {
        setActiveIndex((currentIndex) =>
          Math.min(currentIndex + 1, content.questions.length - 1),
        );
      }, 180);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!allQuestionsAnswered || isSubmitting || isSubmitted) {
      return;
    }

    const answers = content.questions.map((question, index) => ({
      question: question.question,
      selectedOption: answersByQuestion[index]!,
    }));

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await sendUserReply({
        answers,
        correlationId: content.correlationId,
      });
      storeAnswers(content.correlationId, answers);
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error : new Error("Failed to send answers"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeQuestion) {
    return (
      <div className="max-w-[88%] rounded-lg border border-(--border) bg-(--chat-bubble) px-4 py-3 text-sm text-(--text)">
        No questions returned
      </div>
    );
  }

  return (
    <div className="max-w-[88%] rounded-lg border border-(--border) bg-(--chat-bubble) text-sm text-(--text) shadow-sm">
      <div className="border-b border-(--border) px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-(--muted)">
            Question {activeIndex + 1} of {content.questions.length}
          </p>
          {isSubmitted ? (
            <span className="rounded-full bg-(--success-soft) px-2 py-0.5 text-xs font-medium text-(--success)">
              Sent
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-medium leading-6">
          {activeQuestion.question}
        </p>
      </div>

      <div className="space-y-2 px-3 py-3">
        {activeQuestion.options.map((option) => {
          const isSelected = selectedOption === option;

          return (
            <button
              className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left leading-5 transition ${
                isSelected
                  ? "border-(--accent) bg-(--selected) text-(--text)"
                  : "border-(--border) bg-transparent text-(--text) hover:bg-(--control)"
              } disabled:cursor-not-allowed disabled:opacity-70`}
              disabled={isSubmitting || isSubmitted}
              key={option}
              onClick={() => handleSelectOption(option)}
              type="button"
            >
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                  isSelected
                    ? "border-(--accent) bg-(--accent)"
                    : "border-(--muted)"
                }`}
              >
                {isSelected ? (
                  <span className="size-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-(--border) px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {content.questions.map((question, index) => {
              const isActive = index === activeIndex;
              const isAnswered = index in answersByQuestion;

              return (
                <button
                  aria-label={`Go to question ${index + 1}`}
                  className={`size-2.5 rounded-full transition ${
                    isActive
                      ? "bg-(--accent)"
                      : isAnswered
                        ? "bg-(--success)"
                        : "bg-(--border)"
                  }`}
                  disabled={isSubmitting}
                  key={`${question.question}-${index}`}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="h-8 rounded-md border border-(--border) px-3 text-xs font-medium text-(--muted) transition hover:text-(--text) disabled:cursor-not-allowed disabled:opacity-45"
              disabled={activeIndex === 0 || isSubmitting}
              onClick={() =>
                setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0))
              }
              type="button"
            >
              Back
            </button>
            {isLastQuestion ? (
              <button
                className="h-8 rounded-md bg-(--accent) px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!allQuestionsAnswered || isSubmitting || isSubmitted}
                onClick={handleSubmitAnswers}
                type="button"
              >
                {isSubmitting ? "Sending" : isSubmitted ? "Sent" : "Submit"}
              </button>
            ) : (
              <button
                className="h-8 rounded-md border border-(--border) px-3 text-xs font-medium text-(--text) transition hover:bg-(--control) disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isSubmitting}
                onClick={() =>
                  setActiveIndex((currentIndex) =>
                    Math.min(currentIndex + 1, content.questions.length - 1),
                  )
                }
                type="button"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {submitError ? (
          <p className="mt-2 text-xs leading-5 text-red-500">
            {submitError.message}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-(--muted)">
            {answeredCount}/{content.questions.length} answered
          </p>
        )}
      </div>
    </div>
  );
}
