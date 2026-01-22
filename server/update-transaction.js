require('dotenv').config();
const mongoose = require('mongoose');

async function updateTransaction() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Transaction = mongoose.connection.collection('transactions');
    
    // Update the successful payment to completed
    const result = await Transaction.updateOne(
      { reference: 'PS_1769115257568_696eac7d' },
      { $set: { status: 'completed', confirmed_at: new Date() } }
    );
    
    console.log('Updated:', result.modifiedCount);
    
    // Verify the update
    const tx = await Transaction.findOne({ reference: 'PS_1769115257568_696eac7d' });
    console.log('Transaction status now:', tx.status);
    
    // Recalculate balance
    const userId = '696eac7d6369e7a294d6f51e';
    const userObjId = new mongoose.Types.ObjectId(userId);
    
    const depositResult = await Transaction.aggregate([
      { 
        $match: { 
          user_id: userObjId, 
          type: { $in: ['deposit', 'wallet_topup'] }, 
          status: { $in: ['completed', 'confirmed'] } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    console.log('New wallet balance:', depositResult[0]?.total || 0);
    
    await mongoose.disconnect();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateTransaction();
