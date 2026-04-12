import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabase } from "@ai-workflow/database";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("File API", () => {
  let app: FastifyInstance;
  let projectId: string;

  beforeEach(async () => {
    resetDatabase();
    initializeDatabase();
    app = await buildApp();

    const projectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: { title: "Test Project for Files" }
    });
    const projectBody = JSON.parse(projectResponse.payload);
    projectId = projectBody.data.project.id;
  });

  afterEach(async () => {
    fs.rmSync(path.resolve(process.cwd(), "storage/projects", projectId), {
      recursive: true,
      force: true
    });

    if (app.close) {
      await app.close();
    }
  });

  it("should upload a file and persist its metadata", async () => {
    const boundary = "----ai-workflow-test-boundary";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="role"',
      "",
      "source",
      `--${boundary}`,
      'Content-Disposition: form-data; name="asset_type"',
      "",
      "source_story",
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="outline.txt"',
      "Content-Type: text/plain",
      "",
      "Hello from the test upload",
      `--${boundary}--`,
      ""
    ].join("\r\n");

    const uploadResponse = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/files`,
      payload,
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      }
    });

    expect(uploadResponse.statusCode).toBe(201);
    const uploadBody = JSON.parse(uploadResponse.payload);
    expect(uploadBody.ok).toBe(true);
    expect(uploadBody.data.file.file_role).toBe("source");
    expect(uploadBody.data.file.metadata.original_filename).toBe("outline.txt");
    expect(uploadBody.data.file.metadata.asset_type_hint).toBe("source_story");

    const fileId = uploadBody.data.file.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/files`
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.payload);
    expect(listBody.ok).toBe(true);
    expect(listBody.data.items).toHaveLength(1);
    expect(listBody.data.items[0].id).toBe(fileId);

    const contentResponse = await app.inject({
      method: "GET",
      url: `/api/v1/files/${fileId}/content`
    });

    expect(contentResponse.statusCode).toBe(200);
    expect(contentResponse.payload).toBe("Hello from the test upload");
  });

  it("should require a multipart file field", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/files`,
      payload: "",
      headers: {
        "content-type": "multipart/form-data; boundary=missing-file"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad_request");
  });
});
