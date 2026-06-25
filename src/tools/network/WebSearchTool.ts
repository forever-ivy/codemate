import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * WebSearchTool - 网页搜索工具
 *
 * 功能：
 * 1. 使用 DuckDuckGo 进行网页搜索（免费，无需 API Key）
 * 2. 返回搜索结果（标题、URL、摘要）
 * 3. 支持结果数量限制
 *
 * 技术选型：
 * - DuckDuckGo HTML 搜索（免费，无需认证）
 * - 使用 fetch 抓取搜索结果页面
 * - 解析 HTML 提取结果
 *
 * 替代方案（需要 API Key）：
 * - Google Custom Search API（100 次/天免费）
 * - Bing Search API（1000 次/月免费）
 * - SerpAPI（100 次/月免费）
 * - Brave Search API（2000 次/月免费）
 */
export class WebSearchTool extends Tool {
  name = 'web_search';
  description = 'Search the web using DuckDuckGo';

  schema = z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Number of results to return (default: 5)'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { query, limit = 5 } = input;

    console.log(`🔍 Searching web: ${query}`);

    try {
      // 1. 构建 DuckDuckGo 搜索 URL
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      // 2. 发送请求
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 3. 解析 HTML
      const html = await response.text();
      const results = this.parseResults(html, limit);

      console.log(`✅ Found ${results.length} results`);

      return {
        success: true,
        query,
        results,
        count: results.length,
      };
    } catch (error) {
      console.error(`❌ Web search failed:`, error);

      if (error instanceof Error) {
        throw new Error(`Web search failed: ${error.message}`);
      }
      throw new Error('Web search failed: Unknown error');
    }
  }

  /**
   * 解析 DuckDuckGo HTML 搜索结果
   */
  private parseResults(
    html: string,
    limit: number
  ): Array<{
    title: string;
    url: string;
    snippet: string;
  }> {
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    // DuckDuckGo HTML 结构：
    // <div class="result">
    //   <h2 class="result__title">
    //     <a class="result__a" href="/url?...">Title</a>
    //   </h2>
    //   <a class="result__snippet">Snippet text</a>
    // </div>

    // 使用正则表达式提取结果（简化版本）
    // 生产环境建议使用 cheerio 或 jsdom 进行 HTML 解析
    const resultRegex =
      /<div class="result[^"]*"[\s\S]*?<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;

    let match: RegExpExecArray | null;
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      const [, urlPath, title, snippet] = match;

      // 解码 URL（DuckDuckGo 使用 /url?uddg= 格式）
      let url = urlPath;
      if (url.startsWith('/url?uddg=')) {
        url = decodeURIComponent(url.replace('/url?uddg=', ''));
      }

      results.push({
        title: this.decodeHtml(title.trim()),
        url: url.trim(),
        snippet: this.decodeHtml(snippet.trim()),
      });
    }

    return results;
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
