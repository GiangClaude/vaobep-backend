const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENV = process.env.PINECONE_ENV;
const PINECONE_INDEX = process.env.PINECONE_INDEX;


async function retrieve(embedding, topK = 5) {
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) {
    console.error('Thiếu config Pinecone:', { 
      hasKey: !!PINECONE_API_KEY, 
      hasEnv: !!PINECONE_ENV, 
      hasIndex: !!PINECONE_INDEX 
    });
    return [];
  }

  const host = process.env.PINECONE_HOST;
  if (!host) throw new Error("Chưa có PINECONE_HOST");

  const namespace = process.env.PINECONE_NAMESPACE || 'default';
  const url = `${host}/query`;
  
  console.log('Pinecone query URL:', url);
  console.log('Namespace:', namespace);
  console.log('Vector length:', embedding?.length);

  const body = {
    vector: embedding,
    topK,
    includeMetadata: true,
    namespace
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY
    },
    body: JSON.stringify(body)
  });

  const rawText = await res.text(); 
  console.log('Pinecone raw response:', rawText);

  if (!res.ok) {
    console.error('Pinecone retrieve failed, status:', res.status, rawText);
    return [];
  }

  const json = JSON.parse(rawText);
  console.log('Matches found:', json.matches?.length || 0);
  return json.matches || [];
}

async function upsert(vectors, namespace) {
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) throw new Error('Missing Pinecone config');
  const host = process.env.PINECONE_HOST; 
  if(!host) throw new Error("Chưa có PINECONE_HOST");
  
  const url = `${host}/vectors/upsert`;
  const body = { vectors, namespace };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': PINECONE_API_KEY },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Pinecone upsert failed (${res.status}): ${errorText}`);
  }
  return await res.json();
}


async function deleteVector(id, namespace) {
  if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX) throw new Error('Missing Pinecone config');
  const host = process.env.PINECONE_HOST; 
  if(!host) throw new Error("Chưa có PINECONE_HOST");
  
  const url = `${host}/vectors/delete`;
  const body = { 
    ids: [id], 
    namespace: namespace || process.env.PINECONE_NAMESPACE || 'default' 
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': PINECONE_API_KEY },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Pinecone delete failed (${res.status}): ${errorText}`);
  }
  return await res.json();
}


module.exports = { retrieve, upsert, deleteVector };
