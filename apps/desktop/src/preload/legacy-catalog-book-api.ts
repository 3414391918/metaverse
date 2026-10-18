import {
  BookSchema,
  DeleteBookInputSchema,
  DeleteBookResultSchema,
  SaveDocumentInputSchema,
  SaveDocumentResultSchema,
  UpdateBookInputSchema,
  createEnvelope,
  type Book,
  type DeleteBookResult,
  type SaveDocumentInput,
  type SaveDocumentResult,
  type UpdateBookInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function updateBook(rawInput: UpdateBookInput): Promise<Book> {
  const input = UpdateBookInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_update_book");
  return BookSchema.parse(
    await invokeCommand<Book>(
      createEnvelope("catalog.updateBook", input, {
        id,
        correlationId: id,
        context: { resourceId: input.bookId }
      })
    )
  );
}

export async function deleteBook(bookId: string): Promise<DeleteBookResult> {
  const input = DeleteBookInputSchema.parse({ bookId });
  const id = browserId("cmd_catalog_delete_book");
  return DeleteBookResultSchema.parse(
    await invokeCommand<DeleteBookResult>(
      createEnvelope("catalog.deleteBook", input, {
        id,
        correlationId: id,
        context: { resourceId: input.bookId }
      })
    )
  );
}

export async function saveDocument(
  rawInput: SaveDocumentInput
): Promise<SaveDocumentResult> {
  const input = SaveDocumentInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_save_document");
  return SaveDocumentResultSchema.parse(
    await invokeCommand<SaveDocumentResult>(
      createEnvelope("catalog.saveDocument", input, {
        id,
        correlationId: id,
        context: { resourceId: input.bookId }
      })
    )
  );
}
