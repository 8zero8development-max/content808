import { Worker, Job } from 'bullmq';
import { redisConnection } from '../db/redis';
import { query } from '../db/connection';
import { logAudit } from '../services/audit';
import { canTransition } from '../services/transitions';
import { v4 as uuidv4 } from 'uuid';

interface AgentFillData {
    itemId: string;
}

async function processAgentFill(job: Job<AgentFillData>) {
    const { itemId } = job.data;
    console.log(`[agent-fill] Processing item ${itemId}`);

    // 1. Fetch the content item
    const itemResult = await query('SELECT * FROM content_items WHERE id = $1', [itemId]);
    if (itemResult.rows.length === 0) {
        throw new Error(`Content item ${itemId} not found`);
    }
    const item = itemResult.rows[0];

    // 2. Generate mock outputs (ported from prototype)
    const draftCopy = `Draft for ${item.brand} on ${item.platform}: ${item.direction}`;
    const hashtags = [
        `#${(item.brand || '').replace(/\s+/g, '')}`,
        '#contenthub',
        `#${(item.platform || '').toLowerCase()}`,
    ];
    const assetPrompts = [
        `Product hero shot: ${item.direction || 'lifestyle setting'}`,
        `Lifestyle flat-lay: ${item.brand} ${item.platform} content`,
    ];

    // 3. Insert outputs into content_item_outputs (using existing output_data column)
    const outputs = [
        { type: 'draft_copy', data: { text: draftCopy } },
        { type: 'asset_prompt_suggestions', data: { prompts: assetPrompts } },
        { type: 'metadata', data: { hashtags } },
    ];

    for (const output of outputs) {
        await query(
            `INSERT INTO content_item_outputs (id, content_item_id, output_type, output_data, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), itemId, output.type, JSON.stringify(output.data), 'agent-worker']
        );
    }

    // 4. Update final_copy on the content item
    await query(
        'UPDATE content_items SET final_copy = $1, updated_at = NOW() WHERE id = $2',
        [draftCopy, itemId]
    );

    // 5. Transition idea → draft using canTransition for safety
    if (item.status === 'idea' && canTransition('idea', 'draft', 'staff')) {
        await query(
            "UPDATE content_items SET status = 'draft', updated_at = NOW() WHERE id = $1",
            [itemId]
        );

        await logAudit({
            entityType: 'content_item',
            entityId: itemId,
            action: 'transition',
            actor: 'agent-worker',
            actorRole: 'staff',
            details: { from: 'idea', to: 'draft', reason: 'Agent fill completed' },
        });
    }

    // 6. Log agent fill completed
    await logAudit({
        entityType: 'content_item',
        entityId: itemId,
        action: 'agent_fill_completed',
        actor: 'agent-worker',
        actorRole: 'staff',
        details: {
            outputs_generated: outputs.map((o) => o.type),
            draft_copy_length: draftCopy.length,
        },
    });

    console.log(`[agent-fill] Completed item ${itemId}`);
}

let worker: Worker | null = null;

export function startAgentWorker() {
    worker = new Worker<AgentFillData>('agent-fill', processAgentFill, {
        connection: redisConnection,
        concurrency: 3,
    });

    worker.on('completed', (job) => {
        console.log(`[agent-fill] Job ${job.id} completed for item ${job.data.itemId}`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[agent-fill] Job ${job?.id} failed:`, err.message);
    });

    console.log('Agent worker started on queue "agent-fill"');
    return worker;
}

export function getWorker() {
    return worker;
}
