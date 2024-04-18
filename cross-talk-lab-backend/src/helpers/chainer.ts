import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
    RunnableLambda,
    RunnableMap,
    RunnablePassthrough,
} from "@langchain/core/runnables";
import { VectorStore } from "langchain/vectorstores/base";

export type GPTMessage = ["ai" | "human", string];

export class Chainer {

    public async answerQuestion(question: string, vectorStores: VectorStore[], messageHistory: GPTMessage[]) {
        let messages: GPTMessage[] = [
            [
                "ai",
                "Answer the question based on only the following context:\n{context}",
            ],
            ...messageHistory,
            ["human", "{question}"],
        ];
        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chatModel = new ChatOpenAI({});
        const outputParser = new StringOutputParser();

        const retrievers = vectorStores.map(vs => vs.asRetriever(1));
        const contextRetrieval = new RunnableLambda({
            func: async (input: string) => {
                const contexts = await Promise.all(
                    retrievers.map(retriever => retriever.invoke(input))
                );
                return contexts
                    .map(res => res.map(sing => sing.pageContent).join("\n"))
                    .join("\n\n");
            },
        }).withConfig({ runName: "contextRetriever" });

        const setupAndRetrieval = RunnableMap.from({
            context: contextRetrieval,
            question: new RunnablePassthrough(),
        });

        const chain = setupAndRetrieval.pipe(prompt).pipe(chatModel).pipe(outputParser);

        return await chain.invoke(question);
    }

}