import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
} from "../internal/test";
import { createAsyncIterableStream } from "./index";

describe("createAsyncIterableStream()", () => {
  it("should read all chunks from a non-empty stream using async iteration", async () => {
    const testData = ["Hello", "World", "Stream"];

    const source = convertArrayToReadableStream(testData);
    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertAsyncIterableToArray(asyncIterableStream)).toEqual(testData);
  });

  it("should handle an empty stream gracefully", async () => {
    const source = convertArrayToReadableStream<string>([]);
    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertAsyncIterableToArray(asyncIterableStream)).toEqual([]);
  });

  it("should maintain ReadableStream functionality", async () => {
    const testData = ["Hello", "World"];

    const source = convertArrayToReadableStream(testData);
    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertReadableStreamToArray(asyncIterableStream)).toEqual(testData);
  });
});
