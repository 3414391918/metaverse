# 插图提示词设计依据

此处整理公开的图像生成文档与视觉叙事研究，并转为本书连续静态插图的可编辑模板；没有复制第三方项目的提示词全文。文献关注多图连续性，本工具将角色、场景与前一张插图作为跨镜头的视觉锚点，同时要求每张图只呈现一个剧情瞬间。

## 小说插图的场景选择与连续性

- [OpenAI GPT 图像提示词指南：故事插图示例](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)：其多页故事书示例先固定角色外观，再在后续画面中复用角色参考图并推进情节；文档也建议明确镜头、姿态、空间位置和多张参考图各自的用途。本工具据此先形成角色与场景锚点，再写每张图的镜头。
- [ICCV 2025《Generating Visually Consistent Images for Storytelling via Narrative Graph Prompting》](https://openaccess.thecvf.com/content/ICCV2025W/AISTORY/html/Shin_Generating_Visually_Consistent_Images_for_Storytelling_via_Narrative_Graph_Prompting_ICCVW_2025_paper.html)：论文将人物、场景、物件的稳定属性作为持续复用的视觉锚点，再组合场景动作、情绪、机位与光照生成具体画面。本工具不引入论文的图系统，只用已有角色资产和前文插图担当锚点。
- [CVPR 2024《Intelligent Grimm》](https://openaccess.thecvf.com/content/CVPR2024/html/Liu_Intelligent_Grimm_-_Open-ended_Visual_Storytelling_via_Latent_Diffusion_Models_CVPR_2024_paper.html)：故事画面的生成会利用当前文本与前面的图文配对以保持情节和角色连贯。本工具因此通过 `illustration.references` 读取前文插图及其邻近正文，而不是只根据场景名称猜画面。
- [Runway Gen-4 Image Prompting Guide](https://help.runwayml.com/hc/en-us/articles/35694045317139-Gen-4-Image-Prompting-Guide)：说明画风、主体与构图用具体可见的词描述。本工具要求把抽象情绪落实到角色姿态、视线、距离、光源和空间关系。

## 生成模型的画面描述

- [Google Imagen 图像提示词指南](https://cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide)：从主体、背景上下文、风格开始，再补充与画面相关的细节。本工具把它们分成剧情瞬间、人物、场景、构图和风格字段。
- [Google Imagen 画幅比例指南](https://cloud.google.com/vertex-ai/generative-ai/docs/image/configure-aspect-ratio)：比例适合的用途各不相同。本工具先决定画面主体与空间关系，再选择生成器支持的比例，不对整部小说固定单一尺寸。
- [Google Imagen 人物参考图指南](https://cloud.google.com/vertex-ai/generative-ai/docs/image/subject-customization)：人物图片可以作为生成时的主体参考。本工具要求读取当前形象的资产路径并实际传给支持参考图的生图工具。
- [Midjourney 风格参考说明](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)：风格参考侧重色彩、媒介和视觉气质。本工具把角色身份参考与全书插图风格参考分开，避免仅凭风格图推断人物长相。

“单图仅呈现一个时间点”“战斗特效充足但主体清楚”“减少噪声和无关物件”以及“Agent 不做成图审美检查”来自本项目用户的要求。上述文献说明可用的提示词结构与一致性做法，不保证某个生图模型必然正确执行。
