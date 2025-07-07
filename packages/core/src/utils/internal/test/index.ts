export async function convertReadableStreamToArray<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const result: T[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }

  return result;
}

export function convertArrayToAsyncIterable<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield value;
      }
    },
  };
}

export async function convertAsyncIterableToArray<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

export function convertArrayToReadableStream<T>(values: T[]): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      try {
        for (const value of values) {
          controller.enqueue(value);
        }
      } finally {
        controller.close();
      }
    },
  });
}

export async function convertResponseStreamToArray(response: Response): Promise<string[]> {
  // biome-ignore lint/style/noNonNullAssertion: ignore this
  return convertReadableStreamToArray(response.body!.pipeThrough(new TextDecoderStream()));
}
