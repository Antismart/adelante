const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

// For demo purposes, we'll use a mock upload
// In production, you would set up proper Pinata credentials
const DEMO_MODE = true;

interface UploadResult {
  cid: string;
  url: string;
}

/**
 * Upload a file to IPFS via Pinata
 */
export async function uploadToIPFS(file: File): Promise<UploadResult> {
  if (DEMO_MODE) {
    // Generate a mock CID for demo
    const mockCid = `Qm${generateRandomHash(44)}`;
    return {
      cid: mockCid,
      url: `${PINATA_GATEWAY}/${mockCid}`,
    };
  }

  // Production implementation would use Pinata API
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(PINATA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload to IPFS");
  }

  const data = await response.json();
  return {
    cid: data.IpfsHash,
    url: `${PINATA_GATEWAY}/${data.IpfsHash}`,
  };
}

/**
 * Get IPFS URL from CID
 */
export function getIPFSUrl(cid: string): string {
  return `${PINATA_GATEWAY}/${cid}`;
}

/**
 * Generate random hash for demo purposes
 */
function generateRandomHash(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
